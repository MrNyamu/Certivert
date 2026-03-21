;; Certificate Store Contract
;; Core certificate lifecycle with multi-sig approval process
;; Manages certificate proposal, approval, verification, and revocation

;; Error constants
(define-constant ERR-NOT-AUTHORISED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-ALREADY-PENDING (err u409))
(define-constant ERR-ALREADY-SIGNED (err u409))
(define-constant ERR-ALREADY-REVOKED (err u409))
(define-constant ERR-SELF-APPROVAL (err u403))

;; Data variables
(define-data-var admin principal tx-sender)

;; Certificate record structure
(define-map certificates
  (string-ascii 64)  ;; cert-id (SHA-256 hex of cert data)
  {
    student-name:   (string-ascii 100),
    admission-no:   (string-ascii 30),
    programme:      (string-ascii 100),
    year:           uint,
    grade:          (string-ascii 20),
    ipfs-cid:       (string-ascii 100),
    cert-hash:      (string-ascii 64),
    issued-by:      principal,
    issued-at:      uint,           ;; block height
    revoked:        bool,
    revoked-by:     (optional principal),
    revoked-at:     (optional uint)
  }
)

;; Pending multi-sig transaction structure (2-of-2 for prototype)
(define-map pending-txs
  (string-ascii 64)  ;; cert-id
  {
    proposer:       principal,
    signer-2:       (optional principal),
    cert-data:      {
      student-name:   (string-ascii 100),
      admission-no:   (string-ascii 30),
      programme:      (string-ascii 100),
      year:           uint,
      grade:          (string-ascii 20),
      ipfs-cid:       (string-ascii 100),
      cert-hash:      (string-ascii 64),
      issued-by:      principal
    },
    signatures:     uint,          ;; count: 1 after propose, 2 after approve
    proposed-at:    uint
  }
)

;; Track authorised second signers (set by admin)
(define-map authorised-signers principal bool)

;; Private functions

;; Check if user has university role
(define-private (is-university (user principal))
  (contract-call? .role-registry is-university user)
)

;; Check if user has KNQA role  
(define-private (is-knqa (user principal))
  (contract-call? .role-registry is-knqa user)
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions

;; Propose a certificate for issuance (university only)
(define-public (propose-certificate 
  (cert-id (string-ascii 64))
  (student-name (string-ascii 100))
  (admission-no (string-ascii 30))
  (programme (string-ascii 100))
  (year uint)
  (grade (string-ascii 20))
  (ipfs-cid (string-ascii 100))
  (cert-hash (string-ascii 64)))
  (begin
    ;; Check if caller is a university
    (asserts! (is-university tx-sender) ERR-NOT-AUTHORISED)
    ;; Check if certificate doesn't already exist
    (asserts! (is-none (map-get? certificates cert-id)) ERR-ALREADY-EXISTS)
    ;; Check if not already pending
    (asserts! (is-none (map-get? pending-txs cert-id)) ERR-ALREADY-PENDING)
    ;; Create pending transaction
    (map-set pending-txs cert-id {
      proposer: tx-sender,
      signer-2: none,
      cert-data: {
        student-name: student-name,
        admission-no: admission-no,
        programme: programme,
        year: year,
        grade: grade,
        ipfs-cid: ipfs-cid,
        cert-hash: cert-hash,
        issued-by: tx-sender
      },
      signatures: u1,
      proposed-at: stacks-block-height
    })
    (ok true)
  )
)

;; Approve a certificate (authorised signer only, completes 2-of-2)
(define-public (approve-certificate (cert-id (string-ascii 64)))
  (let ((pending-tx (unwrap! (map-get? pending-txs cert-id) ERR-NOT-FOUND)))
    (begin
      ;; Check if caller is authorised signer
      (asserts! (default-to false (map-get? authorised-signers tx-sender)) ERR-NOT-AUTHORISED)
      ;; Check if caller is not the proposer (prevent self-approval)
      (asserts! (not (is-eq tx-sender (get proposer pending-tx))) ERR-SELF-APPROVAL)
      ;; Check if signatures is exactly 1 (ready for second signature)
      (asserts! (is-eq (get signatures pending-tx) u1) ERR-ALREADY-SIGNED)
      ;; Move certificate from pending to certificates map
      (let ((cert-data (get cert-data pending-tx)))
        (map-set certificates cert-id {
          student-name: (get student-name cert-data),
          admission-no: (get admission-no cert-data),
          programme: (get programme cert-data),
          year: (get year cert-data),
          grade: (get grade cert-data),
          ipfs-cid: (get ipfs-cid cert-data),
          cert-hash: (get cert-hash cert-data),
          issued-by: (get issued-by cert-data),
          issued-at: stacks-block-height,
          revoked: false,
          revoked-by: none,
          revoked-at: none
        })
      )
      ;; Remove from pending transactions
      (map-delete pending-txs cert-id)
      (ok true)
    )
  )
)

;; Revoke a certificate (university or KNQA only)
(define-public (revoke-certificate (cert-id (string-ascii 64)))
  (let ((certificate (unwrap! (map-get? certificates cert-id) ERR-NOT-FOUND)))
    (begin
      ;; Check if caller is university or KNQA
      (asserts! (or 
        (is-university tx-sender)
        (is-knqa tx-sender)
      ) ERR-NOT-AUTHORISED)
      ;; Check if not already revoked
      (asserts! (not (get revoked certificate)) ERR-ALREADY-REVOKED)
      ;; Update certificate with revocation details
      (map-set certificates cert-id (merge certificate {
        revoked: true,
        revoked-by: (some tx-sender),
        revoked-at: (some stacks-block-height)
      }))
      (ok true)
    )
  )
)

;; Add authorised signer (admin only)
(define-public (add-authorised-signer (signer principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORISED)
    (map-set authorised-signers signer true)
    (ok true)
  )
)

;; Remove authorised signer (admin only)
(define-public (remove-authorised-signer (signer principal))
  (begin
    (asserts! (is-admin) ERR-NOT-AUTHORISED)
    (map-delete authorised-signers signer)
    (ok true)
  )
)

;; Read-only functions

;; Get certificate by ID
(define-read-only (get-certificate (cert-id (string-ascii 64)))
  (map-get? certificates cert-id)
)

;; Verify certificate status
(define-read-only (verify-certificate (cert-id (string-ascii 64)))
  (match (map-get? certificates cert-id)
    certificate (if (get revoked certificate)
      {
        status: "REVOKED",
        certificate: (some certificate)
      }
      {
        status: "VALID", 
        certificate: (some certificate)
      }
    )
    {
      status: "NOT_FOUND",
      certificate: none
    }
  )
)

;; Get pending transaction by ID
(define-read-only (get-pending-tx (cert-id (string-ascii 64)))
  (map-get? pending-txs cert-id)
)

;; Check if user is authorised signer
(define-read-only (is-authorised-signer (signer principal))
  (default-to false (map-get? authorised-signers signer))
)

;; Get admin address
(define-read-only (get-admin)
  (var-get admin)
)