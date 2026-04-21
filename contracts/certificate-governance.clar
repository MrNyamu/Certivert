;; Certificate Governance Contract
;; Implements two-signer workflow for certificate issuance and revocation
;; University + KNQA must both approve every action

;; ===========================================
;; CONSTANTS & ERROR CODES
;; ===========================================

;; Roles
(define-constant ROLE-NONE u0)
(define-constant ROLE-STUDENT u1)
(define-constant ROLE-UNIVERSITY u2)
(define-constant ROLE-KNQA u3)

;; Certificate Status
(define-constant STATUS-PENDING-ISSUE u100)
(define-constant STATUS-ACTIVE u200)
(define-constant STATUS-PENDING-REVOKE u300)
(define-constant STATUS-REVOKED u400)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-INVALID-STATUS (err u410))
(define-constant ERR-SAME-INITIATOR (err u411))
(define-constant ERR-INVALID-ROLE (err u400))
(define-constant ERR-ALREADY-APPROVED (err u412))

;; ===========================================
;; DATA VARIABLES & MAPS
;; ===========================================

;; Admin principal (contract deployer)
(define-data-var admin principal tx-sender)

;; Role assignments: principal -> role
(define-map roles principal uint)

;; Certificate data structure
(define-map certificates 
  (string-ascii 64)  ;; cert-id
  {
    student-principal: (optional principal),
    university-principal: principal,
    student-name: (string-ascii 100),
    admission-no: (string-ascii 50),
    programme: (string-ascii 100),
    year: uint,
    grade: (string-ascii 20),
    ipfs-cid: (string-ascii 100),
    cert-hash: (string-ascii 64),
    status: uint,
    issued-at: (optional uint),
    revoked-at: (optional uint),
    revocation-reason: (optional (string-ascii 200))
  }
)

;; Pending issuance requests: cert-id -> request data
(define-map pending-issuance
  (string-ascii 64)  ;; cert-id
  {
    university-principal: principal,
    student-name: (string-ascii 100),
    admission-no: (string-ascii 50),
    programme: (string-ascii 100),
    year: uint,
    grade: (string-ascii 20),
    ipfs-cid: (string-ascii 100),
    cert-hash: (string-ascii 64),
    requested-at: uint
  }
)

;; Pending revocation requests: cert-id -> request data
(define-map pending-revocation
  (string-ascii 64)  ;; cert-id
  {
    initiator: principal,
    initiator-role: uint,
    reason: (string-ascii 200),
    requested-at: uint
  }
)

;; ===========================================
;; PRIVATE HELPER FUNCTIONS
;; ===========================================

;; Get user role
(define-private (get-user-role (user principal))
  (default-to ROLE-NONE (map-get? roles user))
)

;; Check if user has specific role
(define-private (has-role (user principal) (required-role uint))
  (is-eq (get-user-role user) required-role)
)

;; Check if user is admin
(define-private (is-admin (user principal))
  (is-eq user (var-get admin))
)

;; Check if user is university
(define-private (is-university (user principal))
  (has-role user ROLE-UNIVERSITY)
)

;; Check if user is KNQA
(define-private (is-knqa (user principal))
  (has-role user ROLE-KNQA)
)

;; ===========================================
;; ADMIN FUNCTIONS (Role Management)
;; ===========================================

;; Set role for a user (admin only)
(define-public (set-user-role (user principal) (role uint))
  (begin
    (asserts! (is-admin tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (<= role ROLE-KNQA) ERR-INVALID-ROLE)
    (map-set roles user role)
    (ok true)
  )
)

;; ===========================================
;; CERTIFICATE ISSUANCE (Two-Step Process)
;; ===========================================

;; Step 1: University requests certificate issuance
(define-public (request-issue-certificate 
  (cert-id (string-ascii 64))
  (student-name (string-ascii 100))
  (admission-no (string-ascii 50))
  (programme (string-ascii 100))
  (year uint)
  (grade (string-ascii 20))
  (ipfs-cid (string-ascii 100))
  (cert-hash (string-ascii 64)))
  (begin
    ;; Check authorization
    (asserts! (is-university tx-sender) ERR-NOT-AUTHORIZED)
    
    ;; Check certificate doesn't already exist
    (asserts! (is-none (map-get? certificates cert-id)) ERR-ALREADY-EXISTS)
    (asserts! (is-none (map-get? pending-issuance cert-id)) ERR-ALREADY-EXISTS)
    
    ;; Create pending issuance request
    (map-set pending-issuance cert-id {
      university-principal: tx-sender,
      student-name: student-name,
      admission-no: admission-no,
      programme: programme,
      year: year,
      grade: grade,
      ipfs-cid: ipfs-cid,
      cert-hash: cert-hash,
      requested-at: stacks-block-height
    })
    
    (ok cert-id)
  )
)

;; Step 2: KNQA approves certificate issuance
(define-public (approve-issue-certificate (cert-id (string-ascii 64)))
  (let (
    (pending-request (unwrap! (map-get? pending-issuance cert-id) ERR-NOT-FOUND))
  )
    (begin
      ;; Check authorization - must be KNQA
      (asserts! (is-knqa tx-sender) ERR-NOT-AUTHORIZED)
      
      ;; Ensure KNQA is not the same as the university that requested
      (asserts! (not (is-eq tx-sender (get university-principal pending-request))) ERR-SAME-INITIATOR)
      
      ;; Create the final certificate
      (map-set certificates cert-id {
        student-principal: none,
        university-principal: (get university-principal pending-request),
        student-name: (get student-name pending-request),
        admission-no: (get admission-no pending-request),
        programme: (get programme pending-request),
        year: (get year pending-request),
        grade: (get grade pending-request),
        ipfs-cid: (get ipfs-cid pending-request),
        cert-hash: (get cert-hash pending-request),
        status: STATUS-ACTIVE,
        issued-at: (some stacks-block-height),
        revoked-at: none,
        revocation-reason: none
      })
      
      ;; Remove from pending
      (map-delete pending-issuance cert-id)
      
      (ok cert-id)
    )
  )
)

;; ===========================================
;; CERTIFICATE REVOCATION (Two-Step Process)
;; ===========================================

;; Step 1: University or KNQA requests revocation
(define-public (request-revoke-certificate 
  (cert-id (string-ascii 64))
  (reason (string-ascii 200)))
  (let (
    (certificate (unwrap! (map-get? certificates cert-id) ERR-NOT-FOUND))
    (initiator-role (get-user-role tx-sender))
  )
    (begin
      ;; Check authorization - must be university or KNQA
      (asserts! (or (is-university tx-sender) (is-knqa tx-sender)) ERR-NOT-AUTHORIZED)
      
      ;; Check certificate is active
      (asserts! (is-eq (get status certificate) STATUS-ACTIVE) ERR-INVALID-STATUS)
      
      ;; Check not already pending revocation
      (asserts! (is-none (map-get? pending-revocation cert-id)) ERR-ALREADY-EXISTS)
      
      ;; Create pending revocation request
      (map-set pending-revocation cert-id {
        initiator: tx-sender,
        initiator-role: initiator-role,
        reason: reason,
        requested-at: stacks-block-height
      })
      
      (ok cert-id)
    )
  )
)

;; Step 2: Other party approves revocation
(define-public (approve-revoke-certificate (cert-id (string-ascii 64)))
  (let (
    (certificate (unwrap! (map-get? certificates cert-id) ERR-NOT-FOUND))
    (pending-revocation-req (unwrap! (map-get? pending-revocation cert-id) ERR-NOT-FOUND))
    (approver-role (get-user-role tx-sender))
  )
    (begin
      ;; Check authorization based on who initiated
      (if (is-eq (get initiator-role pending-revocation-req) ROLE-UNIVERSITY)
        ;; University initiated, KNQA must approve
        (asserts! (is-knqa tx-sender) ERR-NOT-AUTHORIZED)
        ;; KNQA initiated, University must approve
        (asserts! (is-university tx-sender) ERR-NOT-AUTHORIZED)
      )
      
      ;; Ensure approver is not the same as initiator
      (asserts! (not (is-eq tx-sender (get initiator pending-revocation-req))) ERR-SAME-INITIATOR)
      
      ;; Update certificate to revoked status
      (map-set certificates cert-id (merge certificate {
        status: STATUS-REVOKED,
        revoked-at: (some stacks-block-height),
        revocation-reason: (some (get reason pending-revocation-req))
      }))
      
      ;; Remove from pending
      (map-delete pending-revocation cert-id)
      
      (ok cert-id)
    )
  )
)

;; ===========================================
;; READ-ONLY FUNCTIONS (Public Verification)
;; ===========================================

;; Get user role
(define-read-only (get-role (user principal))
  (ok (get-user-role user))
)

;; Get certificate details
(define-read-only (get-certificate (cert-id (string-ascii 64)))
  (ok (map-get? certificates cert-id))
)

;; Verify if certificate is valid (active and not revoked)
(define-read-only (is-certificate-valid (cert-id (string-ascii 64)))
  (match (map-get? certificates cert-id)
    certificate (ok (is-eq (get status certificate) STATUS-ACTIVE))
    (ok false)
  )
)

;; Get certificate status
(define-read-only (get-certificate-status (cert-id (string-ascii 64)))
  (match (map-get? certificates cert-id)
    certificate (ok (get status certificate))
    ERR-NOT-FOUND
  )
)

;; Get pending issuance request
(define-read-only (get-pending-issuance (cert-id (string-ascii 64)))
  (ok (map-get? pending-issuance cert-id))
)

;; Get pending revocation request
(define-read-only (get-pending-revocation (cert-id (string-ascii 64)))
  (ok (map-get? pending-revocation cert-id))
)

;; Get multiple pending issuances by cert-id list
(define-read-only (get-pending-issuances-batch (cert-ids (list 20 (string-ascii 64))))
  (ok (map get-pending-issuance cert-ids))
)

;; Get multiple pending revocations by cert-id list
(define-read-only (get-pending-revocations-batch (cert-ids (list 20 (string-ascii 64))))
  (ok (map get-pending-revocation cert-ids))
)

;; Get multiple certificates by cert-id list
(define-read-only (get-certificates-batch (cert-ids (list 20 (string-ascii 64))))
  (ok (map get-certificate cert-ids))
)

;; Get admin address
(define-read-only (get-admin)
  (ok (var-get admin))
)