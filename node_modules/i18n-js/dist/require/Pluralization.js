"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pluralization = exports.defaultPluralizer = void 0;
const defaultPluralizer = (_i18n, count) => {
    switch (count) {
        case 0:
            return ["zero", "other"];
        case 1:
            return ["one"];
        default:
            return ["other"];
    }
};
exports.defaultPluralizer = defaultPluralizer;
class Pluralization {
    constructor(i18n) {
        this.i18n = i18n;
        this.registry = {};
        this.register("default", exports.defaultPluralizer);
    }
    register(locale, pluralizer) {
        this.registry[locale] = pluralizer;
    }
    get(locale) {
        return (this.registry[locale] ||
            this.registry[this.i18n.locale] ||
            this.registry["default"]);
    }
}
exports.Pluralization = Pluralization;
//# sourceMappingURL=Pluralization.js.map