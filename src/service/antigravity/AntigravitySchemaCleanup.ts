/**
 * JSON Schema cleaning for Antigravity API compatibility.
 * Ported from CLIProxyAPI's CleanJSONSchemaForAntigravity (gemini_schema.go)
 * Required for Claude models in VALIDATED mode.
 */

/**
 * Unsupported constraint keywords that should be moved to description hints.
 * Claude/Gemini reject these in VALIDATED mode.
 */
const UNSUPPORTED_CONSTRAINTS = [
	'minLength',
	'maxLength',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'pattern',
	'minItems',
	'maxItems',
	'format',
	'default',
	'examples',
] as const;

/**
 * Keywords that should be removed after hint extraction.
 */
const UNSUPPORTED_KEYWORDS = [
	...UNSUPPORTED_CONSTRAINTS,
	'$schema',
	'$defs',
	'definitions',
	'const',
	'$ref',
	'additionalProperties',
	'propertyNames',
	'title',
	'$id',
	'$comment',
] as const;

/**
 * Appends a hint to a schema's description field.
 */
function appendDescriptionHint(schema: any, hint: string): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}
	const existing = typeof schema.description === 'string' ? schema.description : '';
	const newDescription = existing ? `${existing} (${hint})` : hint;
	return { ...schema, description: newDescription };
}

/**
 * Phase 1a: Converts $ref to description hints.
 * $ref: "#/$defs/Foo" → { type: "object", description: "See: Foo" }
 */
function convertRefsToHints(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => convertRefsToHints(item));
	}

	if (typeof schema.$ref === 'string') {
		const refVal = schema.$ref;
		const defName = refVal.includes('/') ? refVal.split('/').pop() : refVal;
		const hint = `See: ${defName}`;
		const existingDesc = typeof schema.description === 'string' ? schema.description : '';
		const newDescription = existingDesc ? `${existingDesc} (${hint})` : hint;
		return { type: 'object', description: newDescription };
	}

	const result: any = {};
	for (const [key, value] of Object.entries(schema)) {
		result[key] = convertRefsToHints(value);
	}
	return result;
}

/**
 * Phase 1b: Converts const to enum.
 * { const: "foo" } → { enum: ["foo"] }
 */
function convertConstToEnum(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => convertConstToEnum(item));
	}

	const result: any = {};
	for (const [key, value] of Object.entries(schema)) {
		if (key === 'const' && !schema.enum) {
			result.enum = [value];
		} else {
			result[key] = convertConstToEnum(value);
		}
	}
	return result;
}

/**
 * Phase 1c: Adds enum hints to description.
 * { enum: ["a", "b", "c"] } → adds "(Allowed: a, b, c)" to description
 */
function addEnumHints(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => addEnumHints(item));
	}

	let result: any = { ...schema };

	if (Array.isArray(result.enum) && result.enum.length > 1 && result.enum.length <= 10) {
		const vals = result.enum.map((v: any) => String(v)).join(', ');
		result = appendDescriptionHint(result, `Allowed: ${vals}`);
	}

	for (const [key, value] of Object.entries(result)) {
		if (key !== 'enum' && typeof value === 'object' && value !== null) {
			result[key] = addEnumHints(value);
		}
	}

	return result;
}

/**
 * Phase 1d: Adds additionalProperties hints.
 * { additionalProperties: false } → adds "(No extra properties allowed)" to description
 */
function addAdditionalPropertiesHints(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => addAdditionalPropertiesHints(item));
	}

	let result: any = { ...schema };

	if (result.additionalProperties === false) {
		result = appendDescriptionHint(result, 'No extra properties allowed');
	}

	for (const [key, value] of Object.entries(result)) {
		if (key !== 'additionalProperties' && typeof value === 'object' && value !== null) {
			result[key] = addAdditionalPropertiesHints(value);
		}
	}

	return result;
}

/**
 * Phase 1e: Moves unsupported constraints to description hints.
 * { minLength: 1, maxLength: 100 } → adds "(minLength: 1) (maxLength: 100)" to description
 */
function moveConstraintsToDescription(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => moveConstraintsToDescription(item));
	}

	let result: any = { ...schema };

	for (const constraint of UNSUPPORTED_CONSTRAINTS) {
		if (result[constraint] !== undefined && typeof result[constraint] !== 'object') {
			result = appendDescriptionHint(result, `${constraint}: ${result[constraint]}`);
		}
	}

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === 'object' && value !== null) {
			result[key] = moveConstraintsToDescription(value);
		}
	}

	return result;
}

/**
 * Phase 2a: Merges allOf schemas into a single object.
 */
function mergeAllOf(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => mergeAllOf(item));
	}

	let result: any = { ...schema };

	if (Array.isArray(result.allOf)) {
		const merged: any = {};
		const mergedRequired: string[] = [];

		for (const item of result.allOf) {
			if (!item || typeof item !== 'object') continue;

			if (item.properties && typeof item.properties === 'object') {
				merged.properties = { ...merged.properties, ...item.properties };
			}

			if (Array.isArray(item.required)) {
				for (const req of item.required) {
					if (!mergedRequired.includes(req)) {
						mergedRequired.push(req);
					}
				}
			}

			for (const [key, value] of Object.entries(item)) {
				if (key !== 'properties' && key !== 'required' && merged[key] === undefined) {
					merged[key] = value;
				}
			}
		}

		if (merged.properties) {
			result.properties = { ...result.properties, ...merged.properties };
		}
		if (mergedRequired.length > 0) {
			const existingRequired = Array.isArray(result.required) ? result.required : [];
			result.required = Array.from(new Set([...existingRequired, ...mergedRequired]));
		}

		for (const [key, value] of Object.entries(merged)) {
			if (key !== 'properties' && key !== 'required' && result[key] === undefined) {
				result[key] = value;
			}
		}

		delete result.allOf;
	}

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === 'object' && value !== null) {
			result[key] = mergeAllOf(value);
		}
	}

	return result;
}

/**
 * Scores a schema option for selection in anyOf/oneOf flattening.
 */
function scoreSchemaOption(schema: any): { score: number; typeName: string } {
	if (!schema || typeof schema !== 'object') {
		return { score: 0, typeName: 'unknown' };
	}

	const type = schema.type;

	if (type === 'object' || schema.properties) {
		return { score: 3, typeName: 'object' };
	}

	if (type === 'array' || schema.items) {
		return { score: 2, typeName: 'array' };
	}

	if (type && type !== 'null') {
		return { score: 1, typeName: type };
	}

	return { score: 0, typeName: type || 'null' };
}

/**
 * Checks if an anyOf/oneOf array represents enum choices.
 */
function tryMergeEnumFromUnion(options: any[]): string[] | null {
	if (!Array.isArray(options) || options.length === 0) {
		return null;
	}

	const enumValues: string[] = [];

	for (const option of options) {
		if (!option || typeof option !== 'object') {
			return null;
		}

		if (option.const !== undefined) {
			enumValues.push(String(option.const));
			continue;
		}

		if (Array.isArray(option.enum) && option.enum.length === 1) {
			enumValues.push(String(option.enum[0]));
			continue;
		}

		if (Array.isArray(option.enum) && option.enum.length > 0) {
			for (const val of option.enum) {
				enumValues.push(String(val));
			}
			continue;
		}

		if (option.properties || option.items || option.anyOf || option.oneOf || option.allOf) {
			return null;
		}

		if (option.type && !option.const && !option.enum) {
			return null;
		}
	}

	return enumValues.length > 0 ? enumValues : null;
}

/**
 * Phase 2b: Flattens anyOf/oneOf to the best option with type hints.
 */
function flattenAnyOfOneOf(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => flattenAnyOfOneOf(item));
	}

	let result: any = { ...schema };

	for (const unionKey of ['anyOf', 'oneOf'] as const) {
		if (Array.isArray(result[unionKey]) && result[unionKey].length > 0) {
			const options = result[unionKey];
			const parentDesc = typeof result.description === 'string' ? result.description : '';

			const mergedEnum = tryMergeEnumFromUnion(options);
			if (mergedEnum !== null) {
				const { [unionKey]: _, ...rest } = result;
				result = {
					...rest,
					type: 'string',
					enum: mergedEnum,
				};
				if (parentDesc) {
					result.description = parentDesc;
				}
				continue;
			}

			let bestIdx = 0;
			let bestScore = -1;
			const allTypes: string[] = [];

			for (let i = 0; i < options.length; i++) {
				const { score, typeName } = scoreSchemaOption(options[i]);
				if (typeName) {
					allTypes.push(typeName);
				}
				if (score > bestScore) {
					bestScore = score;
					bestIdx = i;
				}
			}

			let selected = flattenAnyOfOneOf(options[bestIdx]) || { type: 'string' };

			if (parentDesc) {
				const childDesc = typeof selected.description === 'string' ? selected.description : '';
				if (childDesc && childDesc !== parentDesc) {
					selected = { ...selected, description: `${parentDesc} (${childDesc})` };
				} else if (!childDesc) {
					selected = { ...selected, description: parentDesc };
				}
			}

			if (allTypes.length > 1) {
				const uniqueTypes = Array.from(new Set(allTypes));
				const hint = `Accepts: ${uniqueTypes.join(' | ')}`;
				selected = appendDescriptionHint(selected, hint);
			}

			const { [unionKey]: _, description: __, ...rest } = result;
			result = { ...rest, ...selected };
		}
	}

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === 'object' && value !== null) {
			result[key] = flattenAnyOfOneOf(value);
		}
	}

	return result;
}

/**
 * Phase 2c: Flattens type arrays to single type with nullable hint.
 * { type: ["string", "null"] } → { type: "string", description: "(nullable)" }
 */
function flattenTypeArrays(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => flattenTypeArrays(item));
	}

	let result: any = { ...schema };

	if (Array.isArray(result.type)) {
		const types = result.type as string[];
		const hasNull = types.includes('null');
		const nonNullTypes = types.filter((t) => t !== 'null' && t);

		const firstType = nonNullTypes.length > 0 ? nonNullTypes[0] : 'string';
		result.type = firstType;

		if (nonNullTypes.length > 1) {
			result = appendDescriptionHint(result, `Accepts: ${nonNullTypes.join(' | ')}`);
		}

		if (hasNull) {
			result = appendDescriptionHint(result, 'nullable');
		}
	}

	if (result.properties && typeof result.properties === 'object') {
		const newProps: any = {};
		for (const [propKey, propValue] of Object.entries(result.properties)) {
			newProps[propKey] = flattenTypeArrays(propValue);
		}
		result.properties = newProps;
	}

	for (const [key, value] of Object.entries(result)) {
		if (key !== 'properties' && typeof value === 'object' && value !== null) {
			result[key] = flattenTypeArrays(value);
		}
	}

	return result;
}

/**
 * Phase 3: Removes unsupported keywords after hints have been extracted.
 */
function removeUnsupportedKeywords(schema: any, insideProperties: boolean = false): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => removeUnsupportedKeywords(item, false));
	}

	const result: any = {};
	for (const [key, value] of Object.entries(schema)) {
		if (!insideProperties && (UNSUPPORTED_KEYWORDS as readonly string[]).includes(key)) {
			continue;
		}

		if (typeof value === 'object' && value !== null) {
			if (key === 'properties') {
				const propertiesResult: any = {};
				for (const [propName, propSchema] of Object.entries(value as object)) {
					propertiesResult[propName] = removeUnsupportedKeywords(propSchema, false);
				}
				result[key] = propertiesResult;
			} else {
				result[key] = removeUnsupportedKeywords(value, false);
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Phase 3b: Cleans up required fields - removes entries that don't exist in properties.
 */
function cleanupRequiredFields(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => cleanupRequiredFields(item));
	}

	let result: any = { ...schema };

	if (Array.isArray(result.required) && result.properties && typeof result.properties === 'object') {
		const validRequired = result.required.filter((req: string) => Object.prototype.hasOwnProperty.call(result.properties, req));
		if (validRequired.length === 0) {
			delete result.required;
		} else if (validRequired.length !== result.required.length) {
			result.required = validRequired;
		}
	}

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === 'object' && value !== null) {
			result[key] = cleanupRequiredFields(value);
		}
	}

	return result;
}

const EMPTY_SCHEMA_PLACEHOLDER_NAME = '_placeholder';
const EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION = 'Placeholder property for empty object schema';

/**
 * Phase 4: Adds placeholder property for empty object schemas.
 * Claude VALIDATED mode requires at least one property.
 */
function addEmptySchemaPlaceholder(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => addEmptySchemaPlaceholder(item));
	}

	let result: any = { ...schema };

	const isObjectType = result.type === 'object';

	if (isObjectType) {
		const hasProperties = result.properties &&
			typeof result.properties === 'object' &&
			Object.keys(result.properties).length > 0;

		if (!hasProperties) {
			result.properties = {
				[EMPTY_SCHEMA_PLACEHOLDER_NAME]: {
					type: 'boolean',
					description: EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION,
				},
			};
			result.required = [EMPTY_SCHEMA_PLACEHOLDER_NAME];
		}
	}

	for (const [key, value] of Object.entries(result)) {
		if (typeof value === 'object' && value !== null) {
			result[key] = addEmptySchemaPlaceholder(value);
		}
	}

	return result;
}

/**
 * Cleans a JSON schema for Antigravity API compatibility.
 * Transforms unsupported features into description hints while preserving semantic information.
 *
 * Ported from CLIProxyAPI's CleanJSONSchemaForAntigravity (gemini_schema.go)
 */
export function cleanJSONSchemaForAntigravity(schema: any): any {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}

	let result = schema;

	result = convertRefsToHints(result);
	result = convertConstToEnum(result);
	result = addEnumHints(result);
	result = addAdditionalPropertiesHints(result);
	result = moveConstraintsToDescription(result);
	result = mergeAllOf(result);
	result = flattenAnyOfOneOf(result);
	result = flattenTypeArrays(result);
	result = removeUnsupportedKeywords(result);
	result = cleanupRequiredFields(result);
	result = addEmptySchemaPlaceholder(result);

	return result;
}
