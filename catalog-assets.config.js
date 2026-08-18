/**
 * Runtime catalog image storage and delivery configuration.
 *
 * This file is a native ES module so consumers depend on explicit immutable
 * bindings instead of process-wide window globals. The public deploy builder
 * rewrites only catalogAssetBaseUrl while preserving the reviewed delivery mode.
 */
export const catalogAssetBaseUrl = "";
export const catalogImageDeliveryMode = "responsive";
