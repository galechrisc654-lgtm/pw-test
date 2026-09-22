"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeOption = consumeOption;
exports.consumeRepeatedOption = consumeRepeatedOption;
function consumeOption(args, name) {
    const index = args.indexOf(name);
    if (index < 0)
        return undefined;
    const value = args[index + 1];
    if (!value)
        throw new Error(`${name} requires a value`);
    args.splice(index, 2);
    return value;
}
function consumeRepeatedOption(args, name) {
    const values = [];
    while (true) {
        const index = args.indexOf(name);
        if (index < 0)
            return values;
        const value = args[index + 1];
        if (!value)
            throw new Error(`${name} requires a value`);
        values.push(value);
        args.splice(index, 2);
    }
}
