bosco-commit(3) -- Run 'git commit -am' across all repositories in your Github team.
==============================================

## SYNOPSIS

    bosco commit 'Commit Message'
    bosco commit -r <repoPattern> 'Commit Message'

## DESCRIPTION

This command is useful to commit batch updates across all of your repostories - use with care!

The typical use case here is if you want to make a small structural change across all of your services, you can quickly run through and make the change in each, then run this command, followed by `bosco pushall` to commit and then push all the changes up together with the same message.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

## SEE ALSO

* bosco help pushall
