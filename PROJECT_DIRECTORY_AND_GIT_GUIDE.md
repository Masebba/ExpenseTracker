# Project directory and Git guide

## Why there are two folders

The downloaded FinanceTracker ZIP is a standalone source copy. It is not linked to `D:\PILATUS\Projects\ExpenseTracker`, and changes in one folder do not automatically update the other. The ZIP intentionally does not include Git's `.git` directory, so the extracted copy does not inherit the original repository's commit history.

## What happened to existing commits?

Extracting this ZIP does not modify or delete commits in the original `ExpenseTracker` directory. If that folder still exists and its `.git` directory is intact, its existing Git history remains there. This package cannot inspect the Git history on your Windows computer, so confirm locally before deleting or moving either folder.

## Recommended safe workflow

1. Keep `D:\PILATUS\Projects\ExpenseTracker` as a backup until the updated project has been tested.
2. Extract this archive to a clearly named folder such as `D:\PILATUS\Projects\FinanceTracker-workspace-fix-v2`.
3. Use only one folder as the active source for each development session. Stop any existing Metro server with Ctrl+C before starting another.
4. In a terminal opened at the active project's root, run `npm run start:clear` (or `npx expo start --dev-client --clear`) so Metro serves code from that folder. Check the terminal prompt before running commands.
5. The safe Git integration route is to make a backup of the original repository, copy the updated source files into that repository while keeping its `.git` directory, review `git status` and `git diff`, run `npm run check:self`, then commit the reviewed changes. Do not copy the new source's `.git` directory over the original.
6. Do not assume editing the old folder updates the extracted copy, or vice versa. If you continue developing in the new folder, initialize a separate repository deliberately or manually merge reviewed changes into your existing repository.

## Current runtime fix

`CompactFilterMenu.js` previously referenced `fullLabel` and `displayLabel` without defining either variable. Any screen rendering that filter could throw a `ReferenceError`, including Trade, Transactions, Reports, Products, and Orders. The component now defines both labels safely and truncates long visible labels. Development builds also show the caught error message below the generic startup warning to improve diagnosis if another rendering error occurs.
