bosco-team(3) -- Manage your github teams
==============================================

## SYNOPSIS

    bosco team
    bosco team ls
    bosco team sync
    bosco team ln <team> <folder>

## DESCRIPTION

This command allows you to configure and manage your github teams.

### bosco team ls

List teams - this will list each of the teams and the workspace folders they are currently linked to.

### bosco team sync

Synchronise your github team list with bosco - run this whenever you add a new team to Github.  This is also called by 'bosco setup', so you may just run that command whenever you change your teams as it also then runs a 'bosco team ln'.

### bosco team ln <team> <folder>

Link a team to a workspace.

    bosco team ln tes/resources .
    bosco team ln tes/profiles /User/cliftonc/work/profiles

This command then ensures that any bosco commands run in this workspace recognise they are part of this team, and so use the cached repository list.

## SEE ALSO

* bosco help setup
