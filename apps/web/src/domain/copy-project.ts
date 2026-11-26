import type { Project } from "./project";
import { isStructurallyValidTelegramProject } from "./project-json-transfer";

/** Snapshot admitted plain Project data without a platform clone or JSON coercion. */
export function copyProject(project: Project): Project {
	const copied = copyValue(project, new WeakMap());
	if (!isStructurallyValidTelegramProject(copied))
		throw new TypeError("Cannot snapshot an invalid Project");
	return copied;
}

function copyValue(value: unknown, owned: WeakMap<object, object>): unknown {
	if (value === null || typeof value !== "object") return value;
	const previous = owned.get(value);
	if (previous) return previous;
	const copied: object = Array.isArray(value)
		? []
		: Object.create(Object.getPrototypeOf(value));
	if (Array.isArray(value))
		Object.setPrototypeOf(copied, Object.getPrototypeOf(value));
	owned.set(value, copied);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor)
			throw new TypeError("Project data changed during snapshot");
		Object.defineProperty(
			copied,
			key,
			Object.hasOwn(descriptor, "value")
				? { ...descriptor, value: copyValue(descriptor.value, owned) }
				: descriptor,
		);
	}
	return copied;
}
