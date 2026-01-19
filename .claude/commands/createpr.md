---
description: Create a PR from current changes with auto-generated description
argument-hint: <feature-name>
allowed-tools: Bash(git:*), Bash(gh:*)
---

# Create Pull Request

## Current State
- Branch: !`git branch --show-current`
- Status: !`git status --short`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`

## Recent Commits (not on main)
!`git log main..HEAD --oneline 2>/dev/null || git log origin/main..HEAD --oneline 2>/dev/null || echo "No commits ahead of main"`

## Full Diff from Main
!`git diff main...HEAD 2>/dev/null || git diff origin/main...HEAD 2>/dev/null || git diff HEAD~5...HEAD`

## Feature Context
Feature name: $ARGUMENTS

## Task

Create a pull request for the feature "$ARGUMENTS" based on the current changes.

Follow these steps:

1. **Review the changes**
   - Analyze the diff to understand what was modified
   - Identify the main purpose of the changes
   - Note any breaking changes or dependencies

2. **Stage any unstaged changes** (if appropriate)
   - If there are unstaged changes relevant to this feature, stage them
   - If unstaged changes are unrelated, leave them for a separate PR

3. **Create a commit** (if needed)
   - If there are staged but uncommitted changes, create a commit
   - Use conventional commit format: `type(scope): description`
   - **IMPORTANT**: Never mention Claude Code or any AI assistant in commit messages

4. **Push the branch**
   - Ensure all commits are pushed to origin
   - Create tracking branch if needed

5. **Generate PR content**

   Title format: `type(scope): brief description`

   Description format:
   ```
   # Overview
   [Paragraph explaining what was done at a high level. Can include numbered points for major components/features added. Use **bold** for emphasis on key items.]

   ## Key Changes
   **path/to/file1.ts**
   - [Description of what was changed in this file]

   **path/to/file2.ts**
   - [Description of what was changed in this file]

   **path/to/file3.ts**
   - [Description of what was changed in this file]
   ```

   Guidelines for the description:
   - **Overview**: Write a clear summary of the overall purpose. If multiple components were added, use numbered list with bold labels (e.g., `1. **Feature name** - description`)
   - **Key Changes**: List each modified file with its full path in bold, followed by bullet points describing what was changed in that file. Be specific about new types, functions, configurations, or modifications made.
   - **IMPORTANT**: Never include any mention that the PR was generated with Claude Code or any AI assistant. The PR should appear as a normal human-written PR.

6. **Create the PR**
   - Use `gh pr create` with the generated title and body
   - Set appropriate labels if available
   - Request reviewers if specified in project settings

7. **Output the PR URL**
   - Provide the link to the newly created PR