# Threshold Injuries Manual QA

Use a Foundry V13 world with SWNR loaded. These checks cover chat rendering, token selection, permissions, visibility, and embedded item creation that the Node tests intentionally do not simulate.

## Setup

- Enable `Use Threshold Injuries`.
- Create or use one character and one NPC with visible tokens.
- Set `injuryResistance` values manually: `0`, `2`, and `3` across test passes.
- Prepare personal weapon attacks with normal damage, shock, trauma, and a weapon with deferred damage by disabling auto damage roll.
- For CWN armor checks, enable `Use CWN Armor` and set NPC `system.meleeAc` explicitly.

## Trigger Math

- `injuryResistance` 0 with no Edge triggers on 8+.
- `injuryResistance` 2 with no Edge triggers on 10+.
- `injuryResistance` 3 with no Edge cannot trigger on 1d10.
- Natural 20 against `injuryResistance` 3 uses Edge 3 and triggers on 8+.
- Attack total 19 against AC 14 gives Edge 1.
- Attack total 24 against AC 14 gives Edge 2.
- Attack total below current AC applies HP and skips threshold logic unless the attack context is a natural 20.
- Current AC or melee AC changes made after the attack roll but before damage application affect Edge.

## Damage Roles

- Normal weapon damage applies HP and attempts threshold injury once per selected character/NPC.
- Half damage changes HP loss only and shares the same threshold attempt family.
- Modified normal damage changes HP loss only and shares the same threshold attempt family.
- Critical-damage HP application, if present, changes HP only and never attempts or consumes threshold injury.
- Shock, trauma damage, healing, program damage, power damage, reroll damage, and manual health changes never attempt threshold injury.
- Deferred damage from an embedded actor weapon preserves threshold context.
- Deferred damage still works if the source item can no longer be resolved and the minimized chat snapshot is available.

## Multi-Target And State

- Applying the same damage message to two selected character/NPC targets uses each target's current defense and `injuryResistance`.
- Mitigation on the first selected target does not alter HP loss or threshold inputs for the second selected target.
- Repeated clicks from the same client do not reroll threshold injuries for the same source message/action family/target.
- Note residual risk: two simultaneous users may still race until a GM-mediated mutation path exists.
- Targets reduced to 0 HP with Death & Dismemberment wounds do not also create threshold injuries.
- With threshold injuries disabled, existing HP, soak, DR, wounds, floating text, defeated overlays, and above-zero critical injury behavior remain unchanged except the selected-token routing bug fix.

## Visibility And Permissions

- Public attacks produce public threshold injury narration without target number, Edge, resistance, defense, HP pressure, or injury pressure.
- GM-only or blind attacks produce matching private threshold output.
- Hidden target tokens are not named in public output.
- A user without target actor update permission can apply existing HP behavior as before, but threshold marker/injury mutation is skipped with a GM-only note.
- GM users can see and edit `injuryResistance`; non-GM owners see a read-only value.
- As a non-GM owner, run a macro or console update such as `actor.update({"system.injuryResistance": 5})` against an owned character and confirm the value is stripped/rejected and a warning is shown.

## Injury Records

- Triggered Minor creates an embedded injury item and does not increment `system.injuries`.
- Triggered Moderate, Serious, and Severe create one embedded injury item and increment `system.injuries` once.
- Threshold injuries do not increment `system.wounds`.
- Character and NPC injury lists show threshold-specific severity labels and effect text.
