;; Role Registry Contract
;; Manages which wallet addresses hold which roles in the Certivert system
;; Roles: university, student, employer, knqa
;; Only the contract deployer (admin) can assign or revoke roles

;; Error constants
(define-constant ERR-NOT-ADMIN (err u401))
(define-constant ERR-ROLE-NOT-FOUND (err u404))
(define-constant ERR-INVALID-ROLE (err u400))

;; Data variables
;; Admin is the contract deployer
(define-data-var admin principal tx-sender)

;; Data structures
;; Map: principal -> role string
(define-map roles principal (string-ascii 20))

;; Private functions

;; Check if a role is valid
(define-private (is-valid-role (role (string-ascii 20)))
  (or 
    (is-eq role "university")
    (is-eq role "student")
    (is-eq role "employer")
    (is-eq role "knqa")
  )
)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Public functions

;; Assign a role to a user (admin only)
(define-public (assign-role (user principal) (role (string-ascii 20)))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    ;; Check if role is valid
    (asserts! (is-valid-role role) ERR-INVALID-ROLE)
    ;; Assign the role
    (map-set roles user role)
    (ok true)
  )
)

;; Revoke a role from a user (admin only)
(define-public (revoke-role (user principal))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    ;; Check if user has a role
    (asserts! (is-some (map-get? roles user)) ERR-ROLE-NOT-FOUND)
    ;; Remove the role
    (map-delete roles user)
    (ok true)
  )
)

;; Read-only functions

;; Get role for a user
(define-read-only (get-role (user principal))
  (map-get? roles user)
)

;; Check if user has a specific role
(define-read-only (has-role (user principal) (role (string-ascii 20)))
  (match (map-get? roles user)
    user-role (is-eq user-role role)
    false
  )
)

;; Convenience function to check if user is a university
(define-read-only (is-university (user principal))
  (has-role user "university")
)

;; Convenience function to check if user is KNQA
(define-read-only (is-knqa (user principal))
  (has-role user "knqa")
)

;; Get admin address
(define-read-only (get-admin)
  (var-get admin)
)