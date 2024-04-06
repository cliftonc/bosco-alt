bosco-pushall(3) -- Run 'git push origin master' across all repositories in your Github team.
==============================================

## SYNOPSIS

    bosco pushall
    bosco -r <repoPattern> pushall

## DESCRIPTION

This command is useful to commit batch updates across all of your repostories - use with care!

The typical use case here is if you want to make a small structural change across all of your services, you can quickly run through and make the change in each, then run the `bosco commit` command, followed by this to commit and then push all the changes up together with the same message.

## COMMAND LINE OPTIONS

### -r, --repo

* Default: .*
* Type: String

This sets a regex string to use to filter the repostory list.

## SEE ALSO

* bosco help pushall
