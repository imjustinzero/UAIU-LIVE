# UAIU Autonomous Marketplace Pack

This pack adds the last-mile pieces needed to move UAIU.LIVE/X from buyer-execution + seller intake
to a much more autonomous two-sided marketplace.

## What it adds
- automatic seller onboarding + KYB/KYC profile workflow
- structured listing approval queue with rules engine
- seller inventory / registry verification records
- RFQ auto-match flow
- settlement orchestration without manual intervention
- seller payout / release workflow
- exception queue + admin triage
- public platform status / stop page support

## What still requires environment / operator setup
1. Backup scheduler trigger
2. Legal text completion
3. Optional dynamic incident banner wiring
4. Real payout provider hookup if you want actual money movement beyond workflow state

## Integration
See `docs/AUTONOMOUS_MARKETPLACE_INTEGRATION.md`
