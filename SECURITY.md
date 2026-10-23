# Security and school data

This application handles school information. Treat learner records, safeguarding information, credentials and account links as confidential.

## Reporting a concern

Do **not** post passwords, private learner data, authentication responses or unredacted screenshots in public issues or pull requests.

Contact the school's authorised administrator or the repository owner privately. If GitHub private vulnerability reporting is enabled for this repository, it can also be used.

Include:

- The affected page or feature.
- The expected behaviour and what happened.
- Reproduction steps using synthetic information.
- The affected role, without sharing credentials.

## Before sharing source or screenshots

- Keep environment secrets and database connection strings out of Git.
- Exclude school uploads, database exports and unredacted screenshots.
- Use synthetic records or clearly labelled illustrations in documentation.
- Check the Git history as well as the current files: removing a file from the latest commit does not remove earlier copies.
- Do not make a repository public without reviewing its contents and history.

## Development and production

- Use an authorised development database for tests.
- Never run synthetic integration fixtures against production.
- Review and apply database changes separately from application build and startup.
- Verify role restrictions and learner-account mappings before using an installation with real school records.

This document describes handling expectations; it is not a security certification or a guarantee that the application has no vulnerabilities.
