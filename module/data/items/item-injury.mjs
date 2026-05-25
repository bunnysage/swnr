import SWNItemBase from './base-item.mjs';
import SWNShared from '../shared.mjs';

export default class SWNInjury extends SWNItemBase {
  static LOCALIZATION_PREFIXES = [
    'SWN.Item.base',
    'SWN.Item.Injury',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.location = SWNShared.stringChoices("torso", CONFIG.SWN.injuryLocations);

    // Side uses blank: true which isn't available in SWNShared helpers
    schema.side = new fields.StringField({
      required: false,
      blank: true,
      initial: "",
      choices: { "": "", "left": "Left", "right": "Right" }
    });

    schema.severity = SWNShared.requiredNumber(0, 0);

    // daysRemaining is nullable which isn't available in SWNShared helpers
    schema.daysRemaining = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      min: 0,
      initial: null
    });

    schema.treated = new fields.BooleanField({ initial: false });

    schema.injuryType = SWNShared.stringChoices("wound", {
      wound: "Wound",
      criticalMinor: "Critical (Minor)",
      criticalModerate: "Critical (Moderate)"
    });

    return schema;
  }

  /**
   * Get the Font Awesome icon class for this injury's location
   * @returns {string} Font Awesome icon class
   */
  get locationIcon() {
    const icons = {
      arm: "fa-hand",
      leg: "fa-person-walking",
      torso: "fa-vest",
      head: "fa-head-side"
    };
    return icons[this.location] ?? "fa-user-injured";
  }

  /**
   * Get the mechanical effect description based on location and severity
   * @returns {string} Description of the injury's mechanical effects
   */
  get mechanicalEffect() {
    const location = this.location;
    const side = this.side ? SWNShared.capitalizeFirst(this.side) : "";
    const severity = this.severity;

    let effectDescription = "";
    let duration = severity < 11 ? `${severity}` : "Until healed";

    if (location === "arm") {
      effectDescription = `${side}arm disabled for ${duration} days. Cannot hold items, drops anything held.`;
    } else if (location === "leg") {
      effectDescription = `${side}leg disabled for ${duration} days. Falls prone, movement halved.`;
    } else if (location === "torso") {
      effectDescription = `Blood Loss for ${duration} days. Max HP reduced by 1 per HD.`;
    } else if (location === "head") {
      effectDescription = `Concussed for ${duration} days. Acts last in initiative, INT check DC 12 to cast spells.`;
    }

    if (severity >= 11) {
      effectDescription += " Character falls unconscious.";
      if (severity < 16) {
        effectDescription += " Physical save to avoid permanent injury.";
      }
    }

    if (severity >= 16) {
      effectDescription += ` Takes ${severity - 15} additional wounds.`;
    }

    return effectDescription;
  }

  /**
   * Get a formatted display name for the location (with side if applicable)
   * @returns {string} Formatted location name
   */
  get formattedLocation() {
    const sideLabel = this.side ? `${SWNShared.capitalizeFirst(this.side)} ` : "";
    const locationLabel = SWNShared.capitalizeFirst(this.location);
    return `${sideLabel}${locationLabel}`;
  }

  /**
   * Get the duration display string
   * @returns {string} Duration string for display
   */
  get durationDisplay() {
    if (this.daysRemaining === null) {
      return "Until healed";
    }
    return `${this.daysRemaining} days`;
  }
}
