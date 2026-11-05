# Change Log

All notable changes to the "abstergos-codelibrary" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.0]

### Added

- Added metadata editing for scripts and bundles.
- Added support for tags, descriptions, and source references.
- Added metadata display in library tree items and tooltips.
- Added metadata-aware library search.

### Changed

- Updated the README with metadata usage and command documentation.

### Added

- Added library export to a portable JSON file.
- Added library import with generated IDs to avoid collisions.
- Added full-library backup snapshots with timestamped filenames.
- Added safer parsing that ignores function-like text in comments and strings.
- Added improved handling for nested braces, Python decorators, SQL strings, and Makefile targets.
- Added parser tests covering JavaScript, Python, SQL, and Makefile extraction.
- Expanded parser coverage across JavaScript, React, TypeScript, Rust, Java, C++, C, PHP, C#, Kotlin, Swift, Ruby, Go, Dart, Shell, Haskell, MySQL, PostgreSQL, Markdown, Terraform, and Makefile inputs.