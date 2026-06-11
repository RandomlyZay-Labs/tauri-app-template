# Roadmap
  
## chore/release-prep

- Template Finalization
  - Update README template
    - Include instructions for setting up CI and Tauri Updater
      - Go in-depth about Repositiory Secrets and setting up the Fedora COPR repo
    - Make sure a new dev can actually set everything up using just the README?
      - Add an LLM markdown file that developers can point their agents to so they can set up the project for them
  - Codebase audit
    - Audit architecture & code structure
    - Audit third-party packages and libraries (outdated dependencies, bloated tech debt)
    - Audit code for security vulnerabilities
    - Audit code for best practices
    - Audit tests for coverage and quality
    - Audit CI/CD pipeline
  - Reset Repository
    - Squash all commits
    - Clear all tags
    - Reset version to 0.1.0
  - Create a release
