#!/usr/bin/env ruby

require "xcodeproj"

project_path = ARGV.fetch(0, "ios/SofiBabyTracker.xcodeproj")
project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == "SofiBabyTracker" }
abort "SofiBabyTracker target not found in #{project_path}" unless app_target

watch_targets = project.targets.select { |target| target.name.start_with?("SofiBabyWatch") }
app_target.dependencies
  .select { |dependency| watch_targets.include?(dependency.target) }
  .each(&:remove_from_project)

app_target.copy_files_build_phases
  .select { |phase| phase.name == "Embed Watch Content" }
  .each(&:remove_from_project)

project.save
puts "Prepared iOS-only E2E project"
