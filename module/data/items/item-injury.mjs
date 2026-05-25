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
    schema.severity = SWNShared.stringChoices("thresholdMinor", CONFIG.SWN.injurySeverityTypes);
    schema.location = SWNShared.requiredString("");
    schema.mechanicalEffect = SWNShared.requiredString("");
    schema.source = SWNShared.requiredString("");
    schema.persistent = new fields.BooleanField({ initial: false });
    schema.severityScore = SWNShared.requiredNumber(0);
    schema.locationRoll = SWNShared.requiredNumber(0);
    return schema;
  }
}
