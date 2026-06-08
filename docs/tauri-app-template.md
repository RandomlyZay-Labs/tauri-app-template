# Roadmap
  
## chore/release-prep

- Template Finalization
  - Add SPDX Identifiers to all source files
  - Update README template
    - Include instructions for setting up CI and Tauri Updater
    - Can a new dev actually set everything up using just the README?
      - Add an LLM markdown file to let developers just make their agents set up the project for them
  - Update dependencies one last time
    - Update Specta stack to their absolute latest mutually compatible, tested versions
  - Codebase audit
    - Audit architecture & code structure
    - Audit third-party packages and libraries (outdated dependencies, bloated tech debt)
    - Audit code for security vulnerabilities
    - Audit code for best practices
    - Audit tests for coverage and quality
    - Audit CI/CD pipeline
  - Incorporate hard-won lessons in AGENTS.md
  - Create a release
  - Squash all commits
