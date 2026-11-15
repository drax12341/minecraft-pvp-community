# Command access matrix

99 commands and 205 actions. Access is enforced server-side; assignment, tester qualification, role hierarchy, independent review and confirmation rules still apply. Mixed commands such as queue-board/testing-hub require moderation access when publish is true. Discord autocomplete visibility is separate from execution access.

| Command | Minimum access |
| --- | --- |
| `/absent` | tester |
| `/account status` | public |
| `/account region` | public |
| `/account privacy` | public |
| `/add-role` | roles |
| `/alt-check` | security |
| `/analytics` | public |
| `/appeal submit` | public |
| `/appeal status` | public |
| `/appeal review` | moderation |
| `/assessment record` | tester |
| `/assessment show` | tester |
| `/assessment review` | tester |
| `/autosetup` | moderation |
| `/availability` | public |
| `/cdreset` | moderation |
| `/check_verification` | public |
| `/claim` | tester |
| `/close` | tester |
| `/config show` | moderation |
| `/config branding` | moderation |
| `/cooldown status` | public |
| `/cooldown inspect` | moderation |
| `/cooldown reset` | moderation |
| `/cooldown set` | moderation |
| `/cooldown reduce` | moderation |
| `/delivery status` | moderation |
| `/delivery retry` | moderation |
| `/desk` | public |
| `/end` | tester |
| `/forcetier` | moderation |
| `/guide` | public |
| `/health` | moderation |
| `/high-test apply` | public |
| `/high-test status` | public |
| `/high-test list` | tester |
| `/high-test claim` | tester |
| `/high-test room` | public |
| `/high-test prepare` | tester |
| `/high-test ready` | public |
| `/high-test assess` | tester |
| `/high-test review` | tester |
| `/high-test publish` | tester |
| `/high-test schedule` | tester |
| `/high-test release` | tester |
| `/high-test history` | public |
| `/high-test withdraw` | public |
| `/high-test opponent` | tester |
| `/high-test score` | tester |
| `/high-test advance` | tester |
| `/high-test close` | tester |
| `/hightesterlb` | public |
| `/hightesterlbtotal` | public |
| `/hightesterlbuser` | public |
| `/htlb` | public |
| `/htqueue` | tester |
| `/interests` | public |
| `/leaderboard` | public |
| `/leave` | public |
| `/loadout show` | public |
| `/loadout approve` | moderation |
| `/loadout revoke` | moderation |
| `/lock` | channels |
| `/logs` | moderation |
| `/match status` | public |
| `/match start` | tester |
| `/match rules` | public |
| `/match extend` | tester |
| `/match transcript` | tester |
| `/match reassign` | moderation |
| `/match finish` | tester |
| `/match cancel` | tester |
| `/match absent` | tester |
| `/match note` | tester |
| `/match dispute` | public |
| `/member-info` | inspection |
| `/mode list` | public |
| `/mode create` | moderation |
| `/mode edit` | moderation |
| `/mode disable` | moderation |
| `/mode enable` | moderation |
| `/moderation warn` | moderation |
| `/moderation cases` | moderation |
| `/moderation resolve` | moderation |
| `/next` | tester |
| `/notifications` | public |
| `/pause` | tester |
| `/permissions` | public |
| `/player restrict` | moderation |
| `/player unrestrict` | moderation |
| `/player self` | public |
| `/player view` | public |
| `/player history` | public |
| `/practice create` | public |
| `/practice list` | public |
| `/practice close` | public |
| `/preferences` | public |
| `/profile` | public |
| `/progress` | public |
| `/pull` | tester |
| `/qualification grant` | moderation |
| `/qualification revoke` | moderation |
| `/qualification list` | public |
| `/queue join` | public |
| `/queue leave` | public |
| `/queue list` | public |
| `/queue status` | public |
| `/queue forceclose` | moderation |
| `/queue clear` | moderation |
| `/queue-board` | public |
| `/quota status` | tester |
| `/quota set` | moderation |
| `/region list` | public |
| `/region enable` | moderation |
| `/region disable` | moderation |
| `/remove-role` | roles |
| `/request_test_panel` | moderation |
| `/request-test` | public |
| `/restrict` | moderation |
| `/result` | tester |
| `/resume` | tester |
| `/resync` | moderation |
| `/retire request` | public |
| `/retire status` | public |
| `/retire cancel` | public |
| `/retire review` | moderation |
| `/role-info` | public |
| `/roster` | public |
| `/rubric` | public |
| `/security sources` | security |
| `/security audit` | security |
| `/server-info` | public |
| `/session open` | tester |
| `/session pause` | tester |
| `/session close` | tester |
| `/setup` | moderation |
| `/skip` | tester |
| `/slowmode` | channels |
| `/staff roster` | inspection |
| `/staff assign` | owner |
| `/staff remove` | owner |
| `/staff-apply submit` | public |
| `/staff-apply status` | public |
| `/staff-apply review` | moderation |
| `/staff-center` | moderation |
| `/staff-help` | public |
| `/start` | tester |
| `/system status` | moderation |
| `/system resync` | moderation |
| `/test-hub` | public |
| `/test-room open` | public |
| `/test-room ready` | public |
| `/test-room status` | public |
| `/test-room archive` | public |
| `/test-stats` | public |
| `/tester add` | moderation |
| `/tester remove` | moderation |
| `/tester permissions` | moderation |
| `/tester desk` | tester |
| `/tester stats` | public |
| `/tester leaderboard` | public |
| `/tester-apply submit` | public |
| `/tester-apply status` | public |
| `/tester-apply review` | moderation |
| `/tester-desk apply` | public |
| `/tester-desk status` | public |
| `/tester-desk list` | moderation |
| `/tester-desk room` | public |
| `/tester-desk withdraw` | public |
| `/tester-desk review` | moderation |
| `/tester-roster` | public |
| `/testerlb` | public |
| `/testerlbtotal` | public |
| `/testerlbuser` | public |
| `/testing-hub` | public |
| `/ticket reopen` | support |
| `/ticket transcript` | support |
| `/ticket evidence` | public |
| `/ticket link-test` | public |
| `/ticket open` | public |
| `/ticket status` | public |
| `/ticket claim` | support |
| `/ticket recover` | support |
| `/ticket state` | support |
| `/ticket assign` | support |
| `/ticket note` | support |
| `/ticket notes` | support |
| `/ticket close` | public |
| `/tier set` | moderation |
| `/tier reset` | moderation |
| `/tier history` | moderation |
| `/tier-list` | public |
| `/tier-path` | public |
| `/tier-role` | moderation |
| `/timeout` | moderation |
| `/unlock` | channels |
| `/unrestrict` | moderation |
| `/untimeout` | moderation |
| `/verification_panel` | moderation |
| `/verify start` | public |
| `/verify status` | public |
| `/verify-account` | moderation |
| `/waitlist join` | public |
| `/waitlist leave` | public |
| `/waitlist status` | public |
