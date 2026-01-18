# Implement Next Feature

Check the implementation plan at `plans/implementation-plan.md` and identify the next unchecked feature to implement.

## Instructions

1. **Read the plan** - Open and analyze `plans/implementation-plan.md` to find the next feature that hasn't been implemented (unchecked `[ ]` items)

2. **Create a feature branch** - Create a new git branch for this feature using the naming convention `feature/<feature-name>`

3. **Follow TDD approach**:
   - Write failing tests FIRST that define the expected behavior
   - Implement the minimum code to make tests pass
   - Refactor while keeping tests green

4. **Implementation**:
   - Write unit tests for validators/utilities first
   - Implement the code to make tests pass
   - Write integration tests if needed
   - Implement UI components
   - Run all tests to ensure everything passes

5. **Update the plan** - After successful implementation, update `plans/implementation-plan.md` to mark the completed feature(s) as done by changing `[ ]` to `[x]`

6. **Create PR** - Use `/createpr` to create a pull request for the feature branch
