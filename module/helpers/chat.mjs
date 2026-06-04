import {
  buildThresholdAttemptKey,
  calculateThresholdEdge,
  DAMAGE_ROLES,
  getThresholdDefense,
  isThresholdDamageRole,
  validateThresholdAttackContext,
} from "./injury-thresholds.mjs";

export function chatListeners(message, html) {
//  html.on("click", "button.dmgroll", _onDmgRollClick.c(this));
  html.on("click", "button.dmgroll", (event) => _onDmgRollClick.call(this, event, message));

  html.on("click", ".card-buttons button", _onChatCardAction.bind(this));

  // Get native element from jQuery wrapper
  const nativeHtml = html[0] || html;

  // Add reroll buttons to all dice rolls (native DOM)
  nativeHtml.querySelectorAll(".roll").forEach((div) => {
    _addRerollButton(div);
  });

  // Add health buttons to damage rolls (native DOM, pass message for context)
  nativeHtml.querySelectorAll(".roll-damage").forEach((div) => {
    _addHealthButtons(div, message);
  });
  //  html.on("click", ".item-name", _onChatCardToggleContent.bind(this));
  // Desc toggle
  const longDesc = html.find(".longShowDesc");
  if (longDesc) {
    const bind = function (event) {
      event.preventDefault();
      const hiddenDesc = html.find(".hiddenLong");
      const shownDesc = html.find(".hiddenShort");
      hiddenDesc.show();
      //longDesc.hide();
      shownDesc.hide();
    };
    longDesc.on("click", bind);
  }
  const shortDesc = html.find(".longHideDesc");
  if (shortDesc) {
    const bind = function (event) {
      event.preventDefault();
      const hiddenDesc = html.find(".hiddenLong");
      const shownDesc = html.find(".hiddenShort");
      hiddenDesc.hide();
      //longDesc.hide();
      shownDesc.show();
    };
    shortDesc.on("click", bind);
  }

  html.find(".statApplyButton button").each((_i, button) => {
    // fix later
    const actorId = button.dataset.actorId;
    button = $(button);

    //const actorId = message.system["speaker"]["actor"];
    if (!actorId) throw new Error("no id");
    const actor = game.actors?.get(actorId);
    if (!actor) throw new Error("missing actor?");

    if (
      message.getFlag("swnr", "alreadyDone") ||
      (!game.user?.isGM && game.user?.id === user.id)
    ) {
      button.prop("disabled", true);
    } else {
      const bind = function (event) {
        event.preventDefault();
        message.setFlag("swnr", "alreadyDone", true);
        button.prop("disabled", true);
        const messageContent = button.parents(".message-content");
        const stats = {};
        ["str", "dex", "con", "int", "wis", "cha"].forEach((stat) => {
          stats[stat] = {
            base: parseInt(
              messageContent.find(`.stat-${stat} .statBase`).text()
            ),
          };
        });
        actor.update({ system: { stats } });
      };
      button.on("click", bind);
    }
  });
}

function getRerollButton(
  diceRoll,
  isAttack
) {
  const rerollButton = document.createElement("button");
  rerollButton.className = "dice-total-reroll-btn chat-button-small";
  rerollButton.title = game.i18n.localize("swnr.chat.rerollButton");
  const icon = document.createElement("i");
  icon.className = "fas fa-redo";
  rerollButton.appendChild(icon);

  rerollButton.addEventListener("click", async (ev) => {
    const rollMode = game.settings.get("core", "rollMode");
    ev.stopPropagation();
    const roll = new Roll(diceRoll);
    await roll.roll();
    const flavor = "Reroll";
    const chatTemplate = "systems/swnr/templates/chat/re-roll.hbs";
    const chatDialogData = {
      roll: await roll.render(),
      title: flavor,
      isAttack,
    };
    const chatContent = await renderTemplate(chatTemplate, chatDialogData);
    const chatData = {
      speaker: ChatMessage.getSpeaker(),
      roll: JSON.stringify(roll),
      content: chatContent
    };
    getDocumentClass("ChatMessage").applyRollMode(chatData, rollMode);
    getDocumentClass("ChatMessage").create(chatData);
  });
  return rerollButton;
}

export function _addRerollButton(html) {
  const totalDiv = html.querySelector(".dice-total");
  if (!totalDiv) {
    return;
  }
  // Check if this is a re-roll (don't add reroll button to rerolls)
  if (totalDiv.parentElement?.parentElement?.parentElement?.classList.contains("re-roll")) {
    return;
  }

  // Check if reroll button already exists to prevent duplicates
  const parentEl = totalDiv.parentElement;
  let existingContainer = parentEl?.querySelector(".dmgBtn-container");
  if (existingContainer?.querySelector(".dice-total-reroll-btn")) {
    return;
  }

  const formulaEl = parentEl?.querySelector(".dice-formula");
  const diceRoll = formulaEl?.textContent || "";
  const total = parseInt(totalDiv.textContent);
  if (isNaN(total)) {
    console.log("Error in converting a string to a number " + totalDiv.textContent);
    return;
  }

  // Use existing container or create new one
  let btnContainer;
  if (existingContainer) {
    btnContainer = existingContainer;
  } else {
    btnContainer = document.createElement("div");
    btnContainer.className = "dmgBtn-container";
  }
  const rerollButton = getRerollButton(diceRoll, false);
  btnContainer.appendChild(rerollButton);

  // Only append if we created a new container
  if (!existingContainer && parentEl) {
    parentEl.appendChild(btnContainer);
  }
}

export function _addHealthButtons(html, message) {
  const totalDiv = html.querySelector(".dice-total");
  if (!totalDiv) {
    return;
  }

  // Check if health buttons already exist to prevent duplicates
  const parentEl = totalDiv.parentElement;
  let existingContainer = parentEl?.querySelector(".dmgBtn-container");
  if (existingContainer?.querySelector(".dice-total-fullDamage-btn")) {
    return;
  }

  const total = parseInt(totalDiv.textContent);
  if (isNaN(total)) {
    console.log("Error in converting a string to a number " + totalDiv.textContent);
    return;
  }

  const damageRole = html.dataset.damageRole || DAMAGE_ROLES.MANUAL;
  const damageContext = buildDamageApplicationContext({ message, damageRole, amount: total });
  const { isCriticalHit, thresholdContext } = damageContext;

  // Create buttons using native DOM
  const fullDamageButton = document.createElement("button");
  fullDamageButton.type = "button";
  fullDamageButton.className = "dice-total-fullDamage-btn chat-button-small";
  fullDamageButton.title = game.i18n.localize("swnr.chat.healthButtons.fullDamage");
  fullDamageButton.setAttribute("aria-label", fullDamageButton.title);
  const fullDamageIcon = document.createElement("i");
  fullDamageIcon.className = "fas fa-user-minus";
  fullDamageButton.appendChild(fullDamageIcon);

  const halfDamageButton = document.createElement("button");
  halfDamageButton.type = "button";
  halfDamageButton.className = "dice-total-halfDamage-btn chat-button-small";
  halfDamageButton.title = game.i18n.localize("swnr.chat.healthButtons.halfDamage");
  halfDamageButton.setAttribute("aria-label", halfDamageButton.title);
  const halfDamageIcon = document.createElement("i");
  halfDamageIcon.className = "fas fa-user-shield";
  halfDamageButton.appendChild(halfDamageIcon);

  const fullHealingButton = document.createElement("button");
  fullHealingButton.type = "button";
  fullHealingButton.className = "dice-total-fullHealing-btn chat-button-small";
  fullHealingButton.title = game.i18n.localize("swnr.chat.healthButtons.fullHealing");
  fullHealingButton.setAttribute("aria-label", fullHealingButton.title);
  const fullHealingIcon = document.createElement("i");
  fullHealingIcon.className = "fas fa-user-plus";
  fullHealingButton.appendChild(fullHealingIcon);

  const fullDamageModifiedButton = document.createElement("button");
  fullDamageModifiedButton.type = "button";
  fullDamageModifiedButton.className = "dice-total-fullDamageMod-btn chat-button-small";
  fullDamageModifiedButton.title = game.i18n.localize("swnr.chat.healthButtons.fullDamageModified");
  fullDamageModifiedButton.setAttribute("aria-label", fullDamageModifiedButton.title);
  const modifiedIcon = document.createElement("i");
  modifiedIcon.className = "fas fa-user-edit";
  fullDamageModifiedButton.appendChild(modifiedIcon);

  // Use existing container or create new one
  let btnContainer;
  if (existingContainer) {
    btnContainer = existingContainer;
  } else {
    btnContainer = document.createElement("div");
    btnContainer.className = "dmgBtn-container";
  }

  btnContainer.appendChild(fullDamageButton);
  btnContainer.appendChild(fullDamageModifiedButton);
  btnContainer.appendChild(halfDamageButton);
  btnContainer.appendChild(fullHealingButton);

  // Only append if we created a new container
  if (!existingContainer && parentEl) {
    parentEl.appendChild(btnContainer);
  }

  // Handle button clicks - pass critical hit context to damage application
  fullDamageButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    withHealthButtonsDisabled(btnContainer, () => applyHealthDrop(total, { isCriticalHit, damageRole, thresholdContext }));
  });

  fullDamageModifiedButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const enableButtons = disableHealthButtons(btnContainer);
    foundry.applications.api.DialogV2.prompt({
      window: { title: "Apply Modifier to Damage" },
      content: `
        <form>
          <div class="form-group">
            <label>Modifier to damage (${total})</label>
            <input type="text" name="inputField" />
          </div>
        </form>`,
      ok: {
        icon: "fas fa-check",
        label: "Apply",
        callback: (_event, button) => button.form.elements.inputField.value,
      },
      rejectClose: false,
    }).then(async (modifier) => {
      if (modifier && modifier !== "") {
        const nModifier = Number(modifier);
        if (nModifier) {
          await applyHealthDrop(total + nModifier, {
            isCriticalHit,
            damageRole: damageRole === DAMAGE_ROLES.NORMAL ? DAMAGE_ROLES.NORMAL_MODIFIED : damageRole,
            thresholdContext,
          });
        } else {
          ui.notifications?.error(modifier + " is not a number");
        }
      }
    }).catch(() => {}).finally(enableButtons);
  });

  halfDamageButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    withHealthButtonsDisabled(btnContainer, () => applyHealthDrop(Math.floor(total * 0.5), {
      isCriticalHit,
      damageRole: damageRole === DAMAGE_ROLES.NORMAL ? DAMAGE_ROLES.NORMAL_HALF : damageRole,
      thresholdContext,
    }));
  });

  fullHealingButton.addEventListener("click", (ev) => {
    ev.stopPropagation();
    withHealthButtonsDisabled(btnContainer, () => applyHealthDrop(total * -1, { damageRole: DAMAGE_ROLES.HEALING }));
  });
}

function disableHealthButtons(container) {
  const buttons = Array.from(container.querySelectorAll("button"));
  buttons.forEach((button) => { button.disabled = true; });
  return () => buttons.forEach((button) => { button.disabled = false; });
}

async function withHealthButtonsDisabled(container, callback) {
  const enableButtons = disableHealthButtons(container);
  try {
    await callback();
  } finally {
    enableButtons();
  }
}

export async function showValueChange(
  t,
  fillColor,
  total
) {
  const floaterData = {
    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
    direction:
      total > 0
        ? CONST.TEXT_ANCHOR_POINTS.BOTTOM
        : CONST.TEXT_ANCHOR_POINTS.TOP,
    // duration: 2000,
    fontSize: 32,
    fill: fillColor,
    stroke: 0x000000,
    strokeThickness: 4,
    jitter: 0.3,
  };

  if (game?.release?.generation >= 10)
    canvas?.interface?.createScrollingText(
      t.center,
      `${total * -1}`,
      floaterData
    );
  // v10
  else t.hud.createScrollingText(`${total * -1}`, floaterData); // v9
}

function canMutateActor(actor) {
  if (game.user?.isGM) return true;
  if (typeof actor?.canUserModify === "function") return actor.canUserModify(game.user, "update");
  return Boolean(actor?.isOwner);
}

function escapeHtml(value) {
  if (globalThis.foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
  if (!globalThis.document) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

async function sendThresholdGmNote(message) {
  const gmUsers = game.users?.filter((user) => user.isGM).map((user) => user.id) ?? [];
  if (!gmUsers.length) return;
  await ChatMessage.create({
    content: `<p class="swnr threshold-skip-note">${escapeHtml(message)}</p>`,
    whisper: gmUsers,
  });
}

function formatThresholdHpDelta(value) {
  const amount = Number(value) || 0;
  if (amount > 0) return `-${amount}`;
  if (amount < 0) return `+${Math.abs(amount)}`;
  return "0";
}

function formatThresholdSummaryRoll(outcome) {
  if (!outcome.thresholdAttempted) return "not attempted";
  const roll = outcome.thresholdRoll ?? "?";
  const target = outcome.targetNumber ?? "?";
  return `${roll} vs ${target}`;
}

function formatThresholdSummaryResult(outcome) {
  if (outcome.duplicate) return "duplicate skipped";
  if (outcome.thresholdSkippedReason) return `skipped: ${outcome.thresholdSkippedReason}`;
  if (!outcome.thresholdAttempted) return "not attempted";
  if (outcome.thresholdTriggered) return outcome.severityBand?.label
    ? `triggered: ${outcome.severityBand.label}`
    : "triggered";
  return "no trigger";
}

async function sendThresholdApplicationSummary(outcomes, { damageRole, thresholdContext } = {}) {
  if (!shouldUseThresholdRouting(damageRole, thresholdContext)) return;
  const rows = outcomes.filter((outcome) =>
    outcome.thresholdAttempted ||
    outcome.thresholdSkippedReason ||
    outcome.duplicate
  );
  if (!rows.length) return;

  const gmUsers = game.users?.filter((user) => user.isGM).map((user) => user.id) ?? [];
  if (!gmUsers.length) return;

  const rowHtml = rows.map((outcome) => `
    <tr>
      <td>${escapeHtml(outcome.targetLabel ?? outcome.actorId ?? "Target")}</td>
      <td>${escapeHtml(formatThresholdHpDelta(outcome.hpApplied))}</td>
      <td>${escapeHtml(formatThresholdSummaryRoll(outcome))}</td>
      <td>${escapeHtml(formatThresholdSummaryResult(outcome))}</td>
    </tr>
  `).join("");

  await ChatMessage.create({
    content: `
      <div class="swnr threshold-gm-summary">
        <strong>Threshold injury summary</strong>
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>HP</th>
              <th>Threshold</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
    `,
    whisper: gmUsers,
  });
}

export function buildDamageApplicationContext({ message, damageRole = DAMAGE_ROLES.MANUAL, amount } = {}) {
  const thresholdAttack = message?.getFlag("swnr", "thresholdAttack") ||
    message?.getFlag("swnr", "damageRoll")?.thresholdAttack ||
    null;
  const thresholdValidation = validateThresholdAttackContext(thresholdAttack ?? {});
  const normalDamageTotal = Number(thresholdAttack?.normalDamageTotal);
  const amountNumber = Number(amount);
  const hasNormalDamageTotal = thresholdAttack?.normalDamageTotal != null && Number.isFinite(normalDamageTotal);
  const hasTrustedNormalDamageRole =
    hasNormalDamageTotal && (
      (damageRole === DAMAGE_ROLES.NORMAL && normalDamageTotal === amountNumber) ||
      (damageRole === DAMAGE_ROLES.NORMAL_HALF && Math.floor(normalDamageTotal * 0.5) === amountNumber) ||
      (damageRole === DAMAGE_ROLES.NORMAL_MODIFIED && Number.isFinite(amountNumber))
    );
  const thresholdContext = thresholdValidation.valid && hasTrustedNormalDamageRole ? {
    sourceMessageId: thresholdAttack.sourceAttackMessageId || message?.id,
    sourceMessageUuid: thresholdAttack.sourceAttackMessageUuid || message?.uuid,
    message,
    attack: thresholdAttack,
    damageRole: DAMAGE_ROLES.NORMAL,
  } : null;
  const isCriticalHit = damageRole === DAMAGE_ROLES.CRITICAL ||
    Boolean(message?.getFlag("swnr", "isCriticalHit") || message?.getFlag("swnr", "damageRoll")?.isCriticalHit);
  return { isCriticalHit, thresholdContext, damageRole };
}

export async function applyHealthDrop(total, options = {}) {
  const {
    isCriticalHit = false,
    damageRole = DAMAGE_ROLES.MANUAL,
    thresholdContext = null,
  } = options;
  const originalTotal = Number(total);
  if (originalTotal == 0) return []; // Skip changes of 0

  const tokens = canvas?.tokens?.controlled;
  if (!tokens || tokens.length == 0) {
    ui.notifications?.error("Please select at least one token");
    return [];
  }
  // console.log(
  //   `Applying health drop ${total} to ${tokens.length} selected tokens`
  // );

  const outcomes = [];
  for (const t of tokens) {
    const actor = t.actor;
    let targetTotal = originalTotal;
    let isDefeated = false;
    const outcome = {
      tokenId: t.id,
      actorId: actor?.id ?? null,
      targetLabel: t.name || actor?.name || "Target",
      hpApplied: 0,
      woundApplied: false,
      thresholdEligible: false,
      thresholdAttempted: false,
      thresholdTriggered: false,
      thresholdSkippedReason: null,
      duplicate: false,
    };

    if (!actor) {
      ui.notifications?.error("Error getting actor for token " + t.name);
      outcome.thresholdSkippedReason = "missing-actor";
      outcomes.push(outcome);
      continue;
    }
    if (!canMutateActor(actor)) {
      ui.notifications?.warn(`Cannot update ${actor.name}.`);
      outcome.thresholdSkippedReason = "permission";
      outcomes.push(outcome);
      continue;
    }
    if (actor.type == "cyberdeck") {
      const shielding = actor.system.health.value;
      if (targetTotal > 0) {
        // take from shielding first
        const newShielding = Math.max(shielding - targetTotal, 0);
        targetTotal -= shielding - newShielding;
        await actor.update({ "system.health.value": newShielding });
        await showValueChange(t, "0xFFA500", shielding - newShielding);
        if (targetTotal > 0) {
          isDefeated = true;
          const hacker = actor.getHacker();
          // damage still to player
          if (hacker) {
            const oldHealth = hacker.system.health.value;
            const newHealth = Math.max(oldHealth - targetTotal, 0);
            const damage = oldHealth - newHealth;
            await hacker.update({ "system.health.value": newHealth });
            targetTotal = 0; // prevent later damage
            ui.notifications?.info(
              `${hacker.name} takes ${damage} damage, now at ${newHealth} health`
            );
            outcome.hpApplied = damage;
          }
        }
      }
    } else {
      const armorWithDR = actor.items.filter(
        (i) =>
          i.type === "armor" &&
          i.system.use &&
          i.system.location === "readied" &&
          i.system.dr > 0
      );
      const armorDRSum = armorWithDR.reduce((acc, i) => acc + i.system.dr, 0);
      if (armorDRSum > 0) {
        targetTotal -= armorDRSum;
        targetTotal = Math.max(targetTotal, 0);
      }
      if (game.settings.get("swnr", "useCWNArmor")) {
        const armorWithSoak = 
          actor.items.filter(
            (i) =>
              i.type === "armor" &&
              i.system.use &&
              i.system.location === "readied" &&
              i.system.soak.value > 0
          );
        for (const armor of armorWithSoak) {
          if (targetTotal > 0) {
            const soakValue = armor.system.soak.value;
            const newSoak = Math.max(soakValue - targetTotal, 0);
            targetTotal -= soakValue - newSoak;
            await armor.update({ "system.soak.value": newSoak });
            await showValueChange(t, "0xFFA500", soakValue - newSoak);
          }
        }
        if (targetTotal > 0 && actor.type == "npc") {
          const soakValue = actor.system.baseSoakTotal.value;
          const newSoak = Math.max(soakValue - targetTotal, 0);
          targetTotal -= soakValue - newSoak;
          await actor.update({ "system.baseSoakTotal.value": newSoak });
          await showValueChange(t, "0xFFA500", soakValue - newSoak);
        }
      }
      const oldHealth = actor.system.health.value;
      const maxHealth = actor.system.health.max;
      let woundApplied = false;
      if (targetTotal != 0) {
        let newHealth = oldHealth - targetTotal;
        if (newHealth < 0) {
          newHealth = 0;
        } else if (newHealth > maxHealth) {
          newHealth = maxHealth;
        }
        //console.log(`Updating ${actor.name} health to ${newHealth}`);
        await actor.update({ "system.health.value": newHealth });
        outcome.hpApplied = targetTotal;

        // Check for death & dismemberment if enabled
        if (game.settings.get("swnr", "useDeathAndDismemberment") &&
            targetTotal > 0) { // Only on damage, not healing
          if (newHealth <= 0) { // HP at 0 or below
            const excessDamage = Math.max(0, targetTotal - oldHealth);
            woundApplied = true;
            outcome.woundApplied = true;
            await actor.applyWounds(excessDamage);
          } else if (shouldApplyAboveZeroCriticalInjury({ isCriticalHit, damageRole, thresholdContext })) {
            const hpPercentage = newHealth / maxHealth;
            await actor.applyCriticalInjury(hpPercentage);
          }
        }

        if (targetTotal > 0) {
          const thresholdOutcome = await maybeApplyThresholdInjury({
            actor,
            token: t,
            damageRole,
            thresholdContext,
            preDamageHp: oldHealth,
            maxHp: maxHealth,
            woundApplied,
          });
          if (thresholdOutcome) Object.assign(outcome, thresholdOutcome);
        }

        // Taken from Mana
        //https://gitlab.com/mkahvi/fvtt-micro-modules/-/blob/master/pf1-floating-health/floating-health.mjs#L182-194
        const fillColor = targetTotal < 0 ? "0x00FF00" : "0xFF0000";
        showValueChange(t, fillColor, targetTotal);

        // Only apply defeated status if death & dismemberment is disabled
        if (!game.settings.get("swnr", "useDeathAndDismemberment")) {
          if (newHealth <= 0) {
            isDefeated = true;
          } else if (oldHealth <= 0) {
            // token was at <=0 and now is not
            isDefeated = false;
          } else {
            // No defeated-state update needed for this token.
            outcomes.push(outcome);
            continue;
          }
          await t.combatant?.update({ defeated: isDefeated });
          const status = CONFIG.statusEffects.find(
            (e) => e.id === CONFIG.specialStatusEffects.DEFEATED
          );
          if (!status) {
            outcomes.push(outcome);
            continue;
          }
          const effect = actor && status ? status : CONFIG.controlIcons.defeated;
          if (t.object) {
            await t.object.toggleEffect(effect, {
            overlay: true,
            active: isDefeated,
          });
        } else {
          await t.toggleEffect(effect, {
            overlay: true,
            active: isDefeated,
          });
        }
        } // End of death & dismemberment check
      }
    }
    outcomes.push(outcome);
  }
  await sendThresholdApplicationSummary(outcomes, { damageRole, thresholdContext });
  return outcomes;
}

function shouldUseThresholdRouting(damageRole, thresholdContext) {
  return Boolean(
    game.settings.get("swnr", "useThresholdInjuries") &&
    thresholdContext?.attack &&
    isThresholdDamageRole(damageRole)
  );
}

export function shouldApplyAboveZeroCriticalInjury({ isCriticalHit, damageRole, thresholdContext } = {}) {
  return Boolean(
    isCriticalHit &&
    isThresholdDamageRole(damageRole) &&
    !shouldUseThresholdRouting(damageRole, thresholdContext)
  );
}

async function maybeApplyThresholdInjury({
  actor,
  token,
  damageRole,
  thresholdContext,
  preDamageHp,
  maxHp,
  woundApplied,
}) {
  if (!shouldUseThresholdRouting(damageRole, thresholdContext)) return null;
  if (actor.type !== "character" && actor.type !== "npc") return null;

  const validation = await validateThresholdProvenance(thresholdContext);
  if (!validation.valid) {
    await sendThresholdGmNote(`${actor.name}: threshold injury skipped because attack context failed validation (${validation.reason}).`);
    return { thresholdSkippedReason: validation.reason };
  }

  if (woundApplied) {
    await sendThresholdGmNote(`${actor.name}: threshold injury skipped because death-and-dismemberment wounds took precedence.`);
    return { thresholdSkippedReason: "below-zero-preemption" };
  }

  if (!canMutateActor(actor)) {
    await sendThresholdGmNote(`${actor.name}: threshold injury skipped because ${game.user?.name ?? "the user"} cannot update the target actor.`);
    return { thresholdSkippedReason: "permission" };
  }

  const attack = thresholdContext?.attack;
  const edgeResult = calculateThresholdEdge({
    attackTotal: attack?.attackTotal,
    defense: getThresholdDefense(actor, {
      useCWNArmor: game.settings.get("swnr", "useCWNArmor"),
      isMelee: Boolean(attack?.isMelee ?? attack?.sourceItemSnapshot?.isMelee),
    }),
    naturalDie: attack?.naturalDie,
  });
  if (!edgeResult.eligible) {
    return {
      thresholdEligible: false,
      thresholdAttempted: false,
      thresholdSkippedReason: edgeResult.reason,
    };
  }

  const markerKey = buildThresholdAttemptKey({
    sourceMessageId: thresholdContext.sourceMessageId,
    sourceMessageUuid: thresholdContext.sourceMessageUuid,
    targetActorId: actor.id,
    targetActorUuid: actor.uuid,
    targetTokenId: token.id,
    targetTokenUuid: token.document?.uuid,
    damageRole,
  });

  if (actor.getThresholdAttemptMarker(markerKey)) {
    await sendThresholdGmNote(`${actor.name}: duplicate threshold injury attempt skipped.`);
    return { duplicate: true };
  }

  const claimed = await actor.claimThresholdAttempt(markerKey);
  if (!claimed) {
    await sendThresholdGmNote(`${actor.name}: duplicate threshold injury attempt skipped.`);
    return { duplicate: true };
  }

  if (actor.getThresholdAttemptMarker(markerKey)?.attempted !== true) {
    await sendThresholdGmNote(`${actor.name}: threshold injury marker could not be confirmed.`);
    return { thresholdSkippedReason: "marker" };
  }

  return actor.applyThresholdInjury({
    thresholdContext,
    damageRole,
    targetToken: token,
    preDamageHp,
    maxHp,
    sourceMessageId: thresholdContext.sourceMessageId,
    sourceMessageUuid: thresholdContext.sourceMessageUuid,
  });
}

export async function validateThresholdProvenance(thresholdContext) {
  const attack = thresholdContext?.attack;
  const shape = validateThresholdAttackContext(attack ?? {});
  if (!shape.valid) return shape;
  if (!game.user?.isGM) return { valid: false, reason: "gm-required" };
  if (thresholdContext.damageRole !== DAMAGE_ROLES.NORMAL) return { valid: false, reason: "damage-role" };

  const message = thresholdContext.message;
  const sourceActor = attack.sourceActorUuid ? await fromUuid(attack.sourceActorUuid) : game.actors?.get(attack.sourceActorId);
  if (!sourceActor) return { valid: false, reason: "source-actor-missing" };
  if (sourceActor.type !== "character" && sourceActor.type !== "npc") return { valid: false, reason: "source-actor-type" };
  if (attack.isPersonalScaleWeapon !== true) return { valid: false, reason: "source-scale" };
  if (attack.sourceActorId && sourceActor.id !== attack.sourceActorId) return { valid: false, reason: "source-actor-mismatch" };
  if (message?.speaker?.actor && message.speaker.actor !== sourceActor.id) return { valid: false, reason: "speaker-mismatch" };

  const sourceItem = attack.sourceItemUuid ? await fromUuid(attack.sourceItemUuid) : sourceActor.getEmbeddedDocument?.("Item", attack.sourceItemId);
  if (sourceItem) {
    const parentUuid = sourceItem.parent?.uuid ?? sourceItem.actor?.uuid;
    if (parentUuid !== sourceActor.uuid) return { valid: false, reason: "source-item-owner" };
  } else if (!attack.sourceItemSnapshot) {
    return { valid: false, reason: "source-item-missing" };
  }

  const authorId = attack.authorUserId ?? message?.user?.id ?? message?.user;
  const author = authorId ? game.users?.get(authorId) : null;
  if (!author && !game.user?.isGM) return { valid: false, reason: "author-missing" };
  if (author && !author.isGM && typeof sourceActor.testUserPermission === "function" &&
      !sourceActor.testUserPermission(author, "OWNER")) {
    return { valid: false, reason: "author-permission" };
  }

  const sourceMessage = attack.sourceAttackMessageUuid ? await fromUuid(attack.sourceAttackMessageUuid) : message;
  const hitRoll = sourceMessage?.rolls?.[0];
  if (!hitRoll && !game.user?.isGM) return { valid: false, reason: "source-roll-missing" };
  if (hitRoll) {
    if (Number(hitRoll.total) !== Number(attack.attackTotal)) return { valid: false, reason: "attack-total-mismatch" };
    const naturalDie = hitRoll.dice?.[0]?.total;
    if (naturalDie !== undefined && Number(naturalDie) !== Number(attack.naturalDie)) {
      return { valid: false, reason: "natural-die-mismatch" };
    }
  }

  return { valid: true, reason: null };
}

export function _findCharTargets() {
  const chars = [];
  canvas?.tokens?.controlled.forEach((i) => {
    if (i.actor?.type == "character" || i.actor?.type == "npc") {
      chars.push(i.actor);
    }
  });
  if (
    game.user?.character?.type == "character" ||
    game.user?.character?.type == "npc"
  ) {
    chars.push(game.user.character);
  }
  return chars;
}

// Load a saved damage roll from the message flags
export async function _onDmgRollClick(event, message) {
  event.preventDefault();
  const btn = event.currentTarget;
  const ns  = btn.dataset.flagns;
  const key = btn.dataset.flagkey;

  const payload = message.getFlag(ns, key);
  if (!payload?.formula) return;

  const actor = payload.actorId ? game.actors.get(payload.actorId) : null;

  const damageRoll = await (new Roll(payload.formula, payload.data)).evaluate({ async: true });

  let traumaRollRender = null;
  let traumaDamage = null;
  if (payload.traumaFormula) {
    const traumaRoll = new Roll(payload.traumaFormula);
    await traumaRoll.roll();
    traumaRollRender = await traumaRoll.render();
    if (traumaRoll && traumaRoll.total && traumaRoll.total >= 6 && damageRoll?.total) {
      traumaDamage = new Roll(`${payload.traumaRating} * ${damageRoll.total}`);
      await traumaDamage.roll();
      traumaDamage = await traumaDamage.render();
    }
  }
  const rollMode = game.settings.get("core", "rollMode");

  // Calculate critical damage if this was a critical hit
  const isCriticalHit = payload.isCriticalHit || false;
  let criticalDamageTotal = null;
  let criticalDamageRender = null;
  if (isCriticalHit && damageRoll?.total) {
    criticalDamageTotal = damageRoll.total * 2;
    criticalDamageRender = `<span class="critical-damage-value">${criticalDamageTotal}</span> (${damageRoll.total} × 2)`;
  }

  const damageRollTemplate = "systems/swnr/templates/chat/damage-roll.hbs";
  const damageRollData = {
    actor: actor,
    weapon: payload.weaponUuid ? await fromUuid(payload.weaponUuid) : (payload.weaponId ? game.items.get(payload.weaponId) : null),
    damageRoll: damageRoll,
    damage: await damageRoll.render(),
    damageExplain: payload.damageExplain,
    traumaRollRender,
    traumaDamage,
    isCriticalHit,
    criticalDamageTotal,
    criticalDamageRender,
    damageRoles: DAMAGE_ROLES,
  };
  const damageRollContent = await renderTemplate(damageRollTemplate, damageRollData);
  const chatData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: damageRollContent,
    roll: JSON.stringify(damageRoll),
    rolls: [damageRoll],
    flavor: payload.flavor,
  };

  const thresholdAttack = payload.thresholdAttack ? {
    ...payload.thresholdAttack,
    normalDamageTotal: damageRoll.total,
    sourceAttackMessageId: payload.thresholdAttack.sourceAttackMessageId || message.id,
    sourceAttackMessageUuid: payload.thresholdAttack.sourceAttackMessageUuid || message.uuid,
  } : null;

  chatData.flags = {
    swnr: {
      isCriticalHit,
    }
  };
  if (thresholdAttack) chatData.flags.swnr.thresholdAttack = thresholdAttack;

  getDocumentClass("ChatMessage").applyRollMode(chatData, rollMode);
  getDocumentClass("ChatMessage").create(chatData);
}

//Taken from WWN (which could have come from OSE)
export async function _onChatCardAction(
  event
) {
  event.preventDefault();

  // Extract card data
  const button = event.currentTarget;
  //button.disabled = true;
  const card = button.closest(".chat-card");
  const messageLi = button.closest(".message");
  const message = game.messages.get(messageLi.dataset.messageId);
  const action = button.dataset.action;

  // Validate permission to proceed with the roll
  const targets = _findCharTargets();
  if (action === "save") {
    if (!targets.length) {
      ui.notifications?.warn(
        `You must have one or more controlled Tokens in order to use this option.`
      );
      //return (button.disabled = false);
    }
    for (const t of targets) {
      await t.system.rollSave(button.dataset.save);
    }
  } else if (action === "skill") {
    if (!targets.length) {
      ui.notifications?.warn(
        `You must have one or more controlled Tokens in order to use this option.`
      );
      //return (button.disabled = false);
    }
    let skill = button.dataset.skill;
    let stat = null;
    if (skill.indexOf("/") != -1) {
      stat = skill.split("/")[0].toLowerCase();
      skill = skill.split("/")[1];
    }
    for (const t of targets) {
      if (t.type == "npc") {
        const skill = t.system.skillBonus;
        const roll = new Roll("2d6 + @skill", { skill });
        await roll.roll();
        const flavor = game.i18n.format(
          game.i18n.localize("swnr.npc.skill.trained"),
          { actor: t.name }
        );
        roll.toMessage({ flavor, speaker: { actor: t } });
      } else {
        const candidates = t.itemTypes.skill.filter(
          (i) => i.name?.toLocaleLowerCase() === skill.toLocaleLowerCase()
        );
        if (candidates.length == 1) {
          if (candidates[0].type == "skill") {
            if (stat == null || stat === "ask") {
              // No stat given or written as ask. Use roll default.
              candidates[0].roll(false);
            } else {
              // Stat given force the roll
              const skillItem = (
                (candidates[0])
              );
              const dice =
                skillItem.system.pool === "ask"
                  ? "2d6"
                  : skillItem.system.pool;
              const skillRank = skillItem.system.rank;

              const statShortName = game.i18n.localize(
                "swnr.stat.short." + stat
              );
              let statData = {
                mod: 0,
              };

              if (t.system["stats"][stat])
                statData = t.system["stats"][stat];

              skillItem.rollSkill(
                skillItem.name,
                statShortName,
                statData.mod,
                dice,
                skillRank,
                0
              );
            }
          }
        } else {
          ui.notifications?.info(`Cannot find skill ${skill}`);
        }
      }
    }
  } else if (action === "use-power") {
    // Handle power resource spending with unified power system
    const powerId = button.dataset.powerId;
    const actorId = button.dataset.actorId;
    
    if (!powerId || !actorId) {
      ui.notifications?.error("Missing power or actor ID for resource spending");
      return;
    }
    
    // Get the actor and power
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.error("Could not find actor for power usage");
      return;
    }
    
    const power = actor.items.get(powerId);
    if (!power) {
      ui.notifications?.error("Could not find power on actor");
      return;
    }
    
    // Check if user can control this actor
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications?.warn("You do not have permission to use this actor's powers");
      return;
    }
    
    try {
      // Check for selected token to target for costs
      let targetActor = actor;
      const controlled = canvas.tokens?.controlled;
      if (controlled && controlled.length === 1) {
        targetActor = controlled[0].actor;
        if (targetActor !== actor) {
          ui.notifications?.info(`Using selected token for costs: ${targetActor.name}`);
        }
      }
      
      // Use the power's resource spending system (without creating new chat message)
      const result = await power.system._performUseForChatUpdate(targetActor);
      
      if (result.success) {
        // Update the existing chat message with the new state showing recovery buttons
        // Preserve the original power roll from the existing message (don't reroll!)
        const chatCard = $(event.currentTarget).closest('.message');
        const existingRollElement = chatCard.find('.roll');
        let existingPowerRoll = null;
        
        if (existingRollElement.length > 0) {
          // Clone the element and remove any existing button containers to prevent duplication
          const cleanedRoll = existingRollElement.clone();
          cleanedRoll.find('.dmgBtn-container').remove();
          existingPowerRoll = cleanedRoll[0].outerHTML;
        }
        const consumptionResults = result.consumptionResults || [];
        
        // Calculate strain cost
        const totalStrainCost = consumptionResults
          .filter(r => r.type === "systemStrain")
          .reduce((sum, r) => sum + (r.spent || 0), 0);

        // Compute manual consumable presence
        let hasManualConsumables = false;
        const allConsumptions = power.system.consumptions || [];
        for (const c of allConsumptions) {
          if (c && c.type === 'consumableItem' && c.timing === 'manual') { hasManualConsumables = true; break; }
        }
        const consumableRequirements = allConsumptions
          .map((c, idx) => ({ index: idx, ...c }))
          .filter(c => c && c.type === 'consumableItem' && c.timing === 'manual' && (c.itemText || '').trim().length > 0)
          .map(c => ({ index: c.index, amount: c.usesCost || 0, text: (c.itemText || '').trim() }));

        const templateData = {
          actor: actor,
          power: power,
          powerRoll: existingPowerRoll, // Will be null if no roll exists
          strainCost: totalStrainCost,
          isPassive: !power.system.hasConsumption(),
          consumptions: consumptionResults,
          hasManualConsumables,
          hasUnprocessedConsumableManual: hasManualConsumables,
          consumableRequirements
        };



        const template = "systems/swnr/templates/chat/power-usage.hbs";
        const newContent = await foundry.applications.handlebars.renderTemplate(template, templateData);
        
        // Update the current message
        const messageId = chatCard.data('message-id');
        const message = game.messages?.get(messageId);
        if (message) {
          await message.update({ content: newContent });
        }
      }
      
    } catch (error) {
      ui.notifications?.error(`Failed to use power: ${error.message}`);
      console.error("Power usage error:", error);
    }
  } else if (action === "use-consumption") {
    // Handle individual consumption spending with token targeting
    const powerId = button.dataset.powerId;
    const actorId = button.dataset.actorId;
    const consumptionIndex = parseInt(button.dataset.consumptionIndex);
    
    if (!powerId || !actorId || isNaN(consumptionIndex)) {
      ui.notifications?.error("Missing power, actor ID, or consumption index");
      return;
    }
    
    try {
      const messageLi = button.closest(".message");
      const chatMsgLocal = game.messages.get(messageLi.dataset.messageId);
      if (!chatMsgLocal) {
        ui.notifications?.error("Could not find chat message");
        return;
      }

      const speaker = message.speaker;
      let originalActor;
      if (speaker.token) {
        const token = game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
        originalActor = token?.actor;
      } else {
        originalActor = game.actors?.get(speaker.actor);
      }

      if (!originalActor) {
        ui.notifications?.error("Could not find the actor associated with the chat message.");
        return;
      }
      
      const power = originalActor.items?.get(powerId);
      if (!power) {
        ui.notifications?.error("Could not find power");
        return;
      }
      
      // Determine target actor (selected token or original actor)
      let targetActor = originalActor;
      const controlled = canvas.tokens?.controlled;
      if (controlled && controlled.length === 1) {
        targetActor = controlled[0].actor;
        if (targetActor !== originalActor) {
          ui.notifications?.info(`Using selected token for cost: ${targetActor.name}`);
        }
      }
      
      // Get the specific consumption to process using the original array index
      const consumptions = power.system.consumptions || [];
      if (consumptionIndex >= consumptions.length || consumptionIndex < 0) {
        ui.notifications?.error("Invalid consumption index");
        return;
      }
      
      const consumption = consumptions[consumptionIndex];
      if (!consumption || consumption.type === "none") {
        ui.notifications?.error("Invalid consumption for this power");
        return;
      }
      
      // Process the single consumption
      const result = await power.system._processConsumption(targetActor, consumption, {}, consumptionIndex);
      
      if (!result.success) {
        ui.notifications?.error(result.message || "Failed to process consumption");
        return;
      }
      
      // Get existing consumption results from the current message
      const chatCard = $(button).closest('.chat-message');
      const messageId = chatCard.data('message-id');
      const chatMsg = game.messages?.get(messageId);
      
      let existingConsumptions = [];
      if (chatMsg) {
        // Try to parse existing consumptions from message flags or content
        const messageFlags = chatMsg.flags?.swnr?.consumptions;
        if (messageFlags) {
          existingConsumptions = messageFlags;
        }
      }
      
      // Add this consumption result with the index
      result.consumptionIndex = consumptionIndex;
      existingConsumptions.push(result);
      
      // Track which consumptions have been processed
      let processedConsumptions = {};
      if (chatMsg?.flags?.swnr?.processedConsumptions) {
        processedConsumptions = chatMsg.flags.swnr.processedConsumptions;
      }
      processedConsumptions[consumptionIndex] = true;
      
      // Preserve existing power roll
      let existingPowerRoll = null;
      if (chatMsg) {
        const existingRollElement = $(chatMsg.content).find('.roll');
        if (existingRollElement.length > 0) {
          const cleanedRoll = existingRollElement.clone();
          cleanedRoll.find('.dmgBtn-container').remove();
          existingPowerRoll = cleanedRoll[0].outerHTML;
        }
      }
      
      // Calculate total strain cost
      const totalStrainCost = existingConsumptions
        .filter(r => r.type === "systemStrain")
        .reduce((sum, r) => sum + (r.spent || 0), 0);
      
      // Determine if any consumable manual costs remain unprocessed
      let hasUnprocessedConsumableManual = false;
      for (let i = 0; i < consumptions.length; i++) {
        const c = consumptions[i];
        if (!c || c.type === 'none') continue;
        if (c.type === 'consumableItem' && c.timing === 'manual' && !processedConsumptions[i]) { hasUnprocessedConsumableManual = true; break; }
      }

      // Build consumable requirements for display
      const allConsumptions2 = power.system.consumptions || [];
      const consumableRequirements = allConsumptions2
        .map((c, idx) => ({ index: idx, ...c }))
        .filter(c => c && c.type === 'consumableItem' && c.timing === 'manual' && (c.itemText || '').trim().length > 0)
        .map(c => ({ index: c.index, amount: c.usesCost || 0, text: (c.itemText || '').trim() }));

      const templateData = {
        actor: originalActor,
        power: power,
        powerRoll: existingPowerRoll,
        strainCost: totalStrainCost,
        isPassive: false,
        consumptions: existingConsumptions,
        processedConsumptions: processedConsumptions,
        hasUnprocessedConsumableManual,
        consumableRequirements
      };
      
      const template = "systems/swnr/templates/chat/power-usage.hbs";
      const newContent = await foundry.applications.handlebars.renderTemplate(template, templateData);
      
      if (chatMsg) {
        await chatMsg.update({ 
          content: newContent,
          flags: { 
            swnr: { 
              consumptions: existingConsumptions,
              processedConsumptions: processedConsumptions
            } 
          }
        });
      }
      
    } catch (error) {
      ui.notifications?.error(`Failed to use consumption: ${error.message}`);
      console.error("Consumption usage error:", error);
    }
  } else if (action === "use-consumables") {
    // Handle combined consumable item spending via a single button
    const powerId = button.dataset.powerId;
    const actorId = button.dataset.actorId;
    if (!powerId || !actorId) {
      ui.notifications?.error(game.i18n?.localize?.("swnr.consumption.errors.missingPowerOrActor") || "Missing power or actor ID");
      return;
    }
    try {
      const messageLi = button.closest(".message");
      const chatMsgLocal = game.messages.get(messageLi.dataset.messageId);
      if (!chatMsgLocal) {
        ui.notifications?.error(game.i18n?.localize?.("swnr.consumption.errors.noChatMessage") || "Could not find chat message");
        return;
      }

      const speaker = message.speaker;
      let originalActor;
      if (speaker.token) {
        const token = game.scenes.get(speaker.scene)?.tokens.get(speaker.token);
        originalActor = token?.actor;
      } else {
        originalActor = game.actors?.get(speaker.actor);
      }
      if (!originalActor) {
        ui.notifications?.error(game.i18n?.localize?.("swnr.consumption.errors.noActorForMessage") || "Could not find the actor associated with the chat message.");
        return;
      }

      const power = originalActor.items?.get(powerId);
      if (!power) {
        ui.notifications?.error(game.i18n?.localize?.("swnr.consumption.errors.noPower") || "Could not find power");
        return;
      }

      // Determine target actor (selected token or original actor)
      let targetActor = originalActor;
      const controlled = canvas.tokens?.controlled;
      if (controlled && controlled.length === 1) {
        targetActor = controlled[0].actor;
        if (targetActor !== originalActor) {
          ui.notifications?.info(`Using selected token for cost: ${targetActor.name}`);
        }
      }

      // Determine which consumable consumptions are unprocessed
      const consumptions = power.system.consumptions || [];
      const chatCard = $(button).closest('.chat-message');
      const messageId = chatCard.data('message-id');
      const chatMsg = game.messages?.get(messageId);
      let processed = {};
      if (chatMsg?.flags?.swnr?.processedConsumptions) processed = chatMsg.flags.swnr.processedConsumptions;

      const unprocessedIndices = [];
      const requirements = [];
      for (let i = 0; i < consumptions.length; i++) {
        const c = consumptions[i];
        if (!c || c.type === 'none') continue;
        if (c.type === 'consumableItem' && c.timing === 'manual' && !processed[i]) {
          unprocessedIndices.push(i);
          const amt = Math.max(0, c.usesCost || 0);
          const text = (c.itemText || '').trim();
          if (amt > 0 || text) requirements.push({ amount: amt, text });
        }
      }
      if (unprocessedIndices.length === 0) return;

      const result = await power.system._promptAndSpendConsumables(targetActor, requirements);
      if (!result?.success) return;

      // Get existing prior consumption results from message flags
      let existingConsumptions = [];
      if (chatMsg?.flags?.swnr?.consumptions) existingConsumptions = chatMsg.flags.swnr.consumptions;
      existingConsumptions.push(result);

      // Mark all relevant indices as processed
      for (const idx of unprocessedIndices) processed[idx] = true;

      // Preserve existing power roll
      let existingPowerRoll = null;
      if (chatMsg) {
        const existingRollElement = $(chatMsg.content).find('.roll');
        if (existingRollElement.length > 0) {
          const cleanedRoll = existingRollElement.clone();
          cleanedRoll.find('.dmgBtn-container').remove();
          existingPowerRoll = cleanedRoll[0].outerHTML;
        }
      }

      const totalStrainCost = existingConsumptions
        .filter(r => r.type === "systemStrain")
        .reduce((sum, r) => sum + (r.spent || 0), 0);

      // Compute whether any consumable remains unprocessed
      let hasUnprocessedConsumableManual = false;
      for (let i = 0; i < consumptions.length; i++) {
        const c = consumptions[i];
        if (!c || c.type === 'none') continue;
        if (c.type === 'consumableItem' && c.timing === 'manual' && !processed[i]) { hasUnprocessedConsumableManual = true; break; }
      }

      const templateData = {
        actor: originalActor,
        power: power,
        powerRoll: existingPowerRoll,
        strainCost: totalStrainCost,
        isPassive: false,
        consumptions: existingConsumptions,
        processedConsumptions: processed,
        hasUnprocessedConsumableManual,
        consumableRequirements: requirements.filter(r => (r.text || '').trim().length > 0)
      };

      const template = "systems/swnr/templates/chat/power-usage.hbs";
      const newContent = await foundry.applications.handlebars.renderTemplate(template, templateData);

      if (chatMsg) {
        await chatMsg.update({ 
          content: newContent,
          flags: { 
            swnr: { 
              consumptions: existingConsumptions,
              processedConsumptions: processed
            } 
          }
        });
      }
    } catch (error) {
      ui.notifications?.error(`${game.i18n?.localize?.("swnr.consumption.errors.failedConsumeGeneric") || "Failed to consume items"}: ${error.message}`);
      console.error("Consumables usage error:", error);
    }
  } else if (action === "recover-strain") {
    // Handle system strain recovery
    const amount = parseInt(button.dataset.amount);
    const actorId = button.dataset.actorId;
    
    if (!amount || !actorId) {
      ui.notifications?.error("Missing data for strain recovery");
      return;
    }
    
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.error("Could not find actor for strain recovery");
      return;
    }
    
    // Check if user can control this actor
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications?.warn("You do not have permission to modify this actor's strain");
      return;
    }
    
    try {
      const currentStrain = actor.system.systemStrain?.value || 0;
      const newStrain = Math.max(currentStrain - amount, 0);
      await actor.update({ "system.systemStrain.value": newStrain });
      
      // Disable the button
      button.disabled = true;
      button.style.opacity = "0.5";
      button.innerHTML = "<i class='fas fa-check'></i> Recovered";
      
      ui.notifications?.info(`Recovered ${amount} system strain`);
    } catch (error) {
      ui.notifications?.error(`Failed to recover strain: ${error.message}`);
      console.error("Strain recovery error:", error);
    }
  } else if (action === "recover-item") {
    // Handle consumable item recovery
    const itemId = button.dataset.itemId;
    const amount = parseInt(button.dataset.amount);
    const actorId = button.dataset.actorId;
    
    if (!itemId || !amount || !actorId) {
      ui.notifications?.error("Missing data for item recovery");
      return;
    }
    
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.error("Could not find actor for item recovery");
      return;
    }
    
    // Check if user can control this actor
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications?.warn("You do not have permission to modify this actor's items");
      return;
    }
    
    try {
      const item = actor.items.get(itemId);
      if (!item) {
        ui.notifications?.error("Could not find item for recovery");
        return;
      }
      
      const currentUses = item.system.uses?.value || 0;
      const maxUses = item.system.uses?.max || 0;
      const newUses = Math.min(currentUses + amount, maxUses);
      
      await item.update({ "system.uses.value": newUses });
      
      // Disable the button
      button.disabled = true;
      button.style.opacity = "0.5";
      button.innerHTML = "<i class='fas fa-check'></i> Recovered";
      
      ui.notifications?.info(`Recovered ${amount} uses of ${item.name}`);
    } catch (error) {
      ui.notifications?.error(`Failed to recover item: ${error.message}`);
      console.error("Item recovery error:", error);
    }
  } else if (action === "recover-uses") {
    // Handle power internal uses recovery
    const powerId = button.dataset.powerId;
    const consumptionIndex = parseInt(button.dataset.consumptionIndex);
    const amount = parseInt(button.dataset.amount);
    const actorId = button.dataset.actorId;
    
    if (!powerId || consumptionIndex === undefined || !amount || !actorId) {
      ui.notifications?.error("Missing data for uses recovery");
      return;
    }
    
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.error("Could not find actor for uses recovery");
      return;
    }
    
    // Check if user can control this actor
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications?.warn("You do not have permission to modify this actor's powers");
      return;
    }
    
    try {
      const power = actor.items.get(powerId);
      if (!power) {
        ui.notifications?.error("Could not find power for recovery");
        return;
      }
      
      const consumption = power.system.consumptions?.[consumptionIndex];
      if (!consumption || consumption.type !== "uses") {
        ui.notifications?.error("Invalid consumption for uses recovery");
        return;
      }
      
      const currentUses = consumption.uses.value;
      const maxUses = consumption.uses.max;
      const newUses = Math.min(currentUses + amount, maxUses);
      
      // v13-safe: update full array element to avoid sparse array validation
      const updated = foundry.utils.deepClone(power.system.consumptions || []);
      if (!updated[consumptionIndex]) updated[consumptionIndex] = { type: 'uses', uses: { value: 0, max: 1 } };
      updated[consumptionIndex].type = 'uses';
      updated[consumptionIndex].uses = {
        ...(updated[consumptionIndex].uses || { value: 0, max: 1 }),
        value: newUses,
        max: maxUses
      };
      await power.update({ "system.consumptions": updated });
      
      // Disable the button
      button.disabled = true;
      button.style.opacity = "0.5";
      button.innerHTML = "<i class='fas fa-check'></i> Recovered";
      
      ui.notifications?.info(`Recovered ${amount} uses of ${power.name}`);
    } catch (error) {
      ui.notifications?.error(`Failed to recover uses: ${error.message}`);
      console.error("Uses recovery error:", error);
    }
  } else if (action === "releaseCommitment") {
    // Handle manual release of committed effort from chat
    const poolKey = button.dataset.poolKey;
    const powerId = button.dataset.powerId;
    const actorId = button.dataset.actorId;
    
    if (!poolKey || !powerId || !actorId) {
      ui.notifications?.error("Missing data for commitment release");
      return;
    }
    
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.error("Could not find actor for commitment release");
      return;
    }
    
    // Check if user can control this actor
    if (!actor.isOwner && !game.user?.isGM) {
      ui.notifications?.warn("You do not have permission to modify this actor's commitments");
      return;
    }
    
    try {
      const commitments = actor.system.effortCommitments || {};
      const poolCommitments = commitments[poolKey] || [];
      
      // Find and remove the specific commitment
      const commitmentIndex = poolCommitments.findIndex(c => c.powerId === powerId);
      if (commitmentIndex === -1) {
        ui.notifications?.warn("Could not find commitment to release");
        return;
      }
      
      const releasedCommitment = poolCommitments[commitmentIndex];
      poolCommitments.splice(commitmentIndex, 1);
      
      // Update actor with released commitment
      const newCommitments = { ...commitments };
      newCommitments[poolKey] = poolCommitments;
      
      // Recalculate pool availability
      const pools = actor.system.pools || {};
      const pool = pools[poolKey];
      if (pool) {
        const totalCommitted = poolCommitments.reduce((sum, c) => sum + c.amount, 0);
        const newValue = Math.min(pool.max, pool.value + releasedCommitment.amount);
        
        await actor.update({
          "system.effortCommitments": newCommitments,
          [`system.pools.${poolKey}.value`]: newValue,
          [`system.pools.${poolKey}.committed`]: totalCommitted,
          [`system.pools.${poolKey}.commitments`]: poolCommitments
        });
        
        // Disable the button
        button.disabled = true;
        button.style.opacity = "0.5";
        button.innerHTML = "<i class='fas fa-check'></i> Released";
        
        ui.notifications?.info(`Released ${releasedCommitment.amount} effort from ${releasedCommitment.powerName}`);
      }
    } catch (error) {
      ui.notifications?.error(`Failed to release commitment: ${error.message}`);
      console.error("Commitment release error:", error);
    }
  }
}

export async function welcomeMessage() {
		const template = "systems/swnr/templates/chat/welcome.hbs";

		const content = await renderTemplate(template, {});
		const card = {
			content,
			user: game.user.id,
			whisper: [game.user.id],
			flags: { core: { canPopout: true } },
			speaker: { alias: "wintersleepAI" },
		};
		await ChatMessage.create(card);

}
