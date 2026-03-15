"use client";

import { useForm, Controller } from "react-hook-form";
import type { FormFieldDef } from "@/lib/form-schema";
import { clsx } from "clsx";
import { useGoogleDrivePicker } from "@/hooks/useGoogleDrivePicker";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-green focus:ring-offset-1"
        aria-label={text}
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 max-w-xs rounded-lg border border-slate-200 bg-slate-800 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

interface DynamicFormProps {
  fields: FormFieldDef[];
  onSubmit: (values: Record<string, string | number | boolean>) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  /** When true, submit button is disabled (e.g. when required integrations are not connected). */
  disableSubmit?: boolean;
}

/** Read file(s) as base64 and return JSON string of { name, data }[] */
async function filesToBase64Json(files: FileList | null): Promise<string> {
  if (!files?.length) return "[]";
  const list: { name: string; data: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string) ?? "");
      r.onerror = () => reject(new Error("Failed to read file"));
      r.readAsDataURL(f);
    });
    list.push({ name: f.name, data });
  }
  return JSON.stringify(list);
}

export function DynamicForm({
  fields,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Run workflow",
  disableSubmit = false,
}: DynamicFormProps) {
  const defaultValues: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) defaultValues[f.variableName] = f.defaultValue as string | number | boolean;
    else if (f.type === "checkbox") defaultValues[f.variableName] = false;
    else if (f.type === "multiselect") defaultValues[f.variableName] = ""; // will hold comma-separated on submit
    else defaultValues[f.variableName] = "";
  }

  const { register, handleSubmit, control, watch, formState: { errors }, setError, setValue, clearErrors } = useForm({
    defaultValues,
  });
  const { openPicker, isApiLoaded, error: driveError } = useGoogleDrivePicker();

  /** For dependent parameters: only show field when parent has showWhen value */
  const isFieldVisible = (field: FormFieldDef): boolean => {
    if (!field.dependsOn || field.showWhen === undefined) return true;
    const parentValue = watch(field.dependsOn);
    return String(parentValue ?? "") === String(field.showWhen);
  };

  const handleDriveSelect = (variableName: string) => (result: { id: string; name: string; url?: string }) => {
    const value = result.url || result.id || result.name;
    setValue(variableName, value);
    clearErrors(variableName);
  };

  const onFormSubmit = handleSubmit(async (values) => {
    const out: Record<string, string | number | boolean> = { ...values };
    for (const f of fields) {
      if (f.type === "file") {
        if (f.integrationSource === "gdrive") {
          // Google Drive: value is already url/id string from picker
          const driveValue = values[f.variableName];
          if (f.required && (driveValue == null || String(driveValue).trim() === "")) {
            setError(f.variableName, { type: "required", message: "Please select a file from Google Drive." });
            return;
          }
          out[f.variableName] = typeof driveValue === "string" ? driveValue : String(driveValue ?? "");
        } else {
          const input = document.getElementById(`file-${f.variableName}`) as HTMLInputElement | null;
          const fileList = input?.files ?? null;
          if (f.required && (!fileList || fileList.length === 0)) {
            setError(f.variableName, { type: "required", message: "At least one file is required." });
            return;
          }
          out[f.variableName] = await filesToBase64Json(fileList);
        }
      }
    }
    onSubmit(out);
  });

  return (
    <form onSubmit={onFormSubmit} className="space-y-5">
      {fields.map((field) => {
        if (!isFieldVisible(field)) return null;
        return (
        <div key={field.variableName}>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary-black">
            <span>{field.label}</span>
            {field.required && <span className="text-red-500">*</span>}
            {field.description && (
              <InfoTooltip text={field.description} />
            )}
          </label>
          {field.type === "textarea" && (
            <div className="space-y-2">
              <textarea
                {...register(field.variableName, { required: field.required })}
                placeholder={field.placeholder}
                rows={3}
                className={clsx(
                  "w-full rounded-lg border px-3 py-2 text-sm",
                  errors[field.variableName] ? "border-red-500" : "border-gray-300"
                )}
              />
              {field.integrationSource === "gdrive" && (
                <div>
                  <button
                    type="button"
                    onClick={() => openPicker(handleDriveSelect(field.variableName))}
                    disabled={!isApiLoaded}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-primary-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="inline-block h-4 w-4 rounded bg-[#4285F4] text-center text-[10px] font-bold leading-4 text-white">G</span>
                    {isApiLoaded ? "Select from Google Drive" : "Loading…"}
                  </button>
                  {driveError && <p className="mt-1 text-xs text-red-500">{driveError}</p>}
                </div>
              )}
            </div>
          )}
          {field.type === "select" && (
            <select
              {...register(field.variableName, { required: field.required })}
              className={clsx(
                "w-full rounded-lg border px-3 py-2 text-sm",
                errors[field.variableName] ? "border-red-500" : "border-gray-300"
              )}
            >
              <option value="">Select...</option>
              {(field.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          {field.type === "multiselect" && (
            <Controller
              name={field.variableName}
              control={control}
              rules={{ required: field.required }}
              render={({ field: f }) => {
                const selected = (f.value ? String(f.value).split(",").map((s) => s.trim()).filter(Boolean) : []) as string[];
                return (
                  <div className="space-y-2 rounded-lg border border-gray-300 bg-gray-50/50 px-3 py-2">
                    {(field.options || []).map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(opt.value)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            f.onChange(next.length ? next.join(",") : "");
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary-green"
                        />
                        <span className="text-primary-black">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                );
              }}
            />
          )}
          {field.type === "file" && (
            <div className="space-y-2">
              {field.integrationSource === "gdrive" ? (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      {...register(field.variableName, { required: field.required })}
                      placeholder="Select a file from Google Drive"
                      readOnly
                      className={clsx(
                        "w-full rounded-lg border px-3 py-2 text-sm bg-gray-50",
                        errors[field.variableName] ? "border-red-500" : "border-gray-300"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => openPicker(handleDriveSelect(field.variableName))}
                      disabled={!isApiLoaded}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-primary-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Select from Google Drive"
                    >
                      <span className="inline-block h-5 w-5 rounded bg-[#4285F4] text-center text-xs font-bold leading-5 text-white">
                        G
                      </span>
                      {isApiLoaded ? "Drive" : "…"}
                    </button>
                  </div>
                  {driveError && <p className="text-xs text-red-500">{driveError}</p>}
                </>
              ) : (
                <>
                  <input
                    id={`file-${field.variableName}`}
                    type="file"
                    multiple={field.multiple === true}
                    className={clsx(
                      "w-full rounded-lg border px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-primary-green file:px-3 file:py-1 file:text-white file:text-sm",
                      errors[field.variableName] ? "border-red-500" : "border-gray-300"
                    )}
                  />
                  {field.multiple && (
                    <p className="mt-1 text-xs text-primary-grey">You can select multiple files.</p>
                  )}
                </>
              )}
            </div>
          )}
          {field.type === "checkbox" && (
            <input
              type="checkbox"
              {...register(field.variableName)}
              className="h-4 w-4 rounded border-gray-300 text-primary-green"
            />
          )}
          {field.type === "number" && (
            <input
              type="number"
              {...register(field.variableName, { required: field.required, valueAsNumber: true })}
              placeholder={field.placeholder}
              className={clsx(
                "w-full rounded-lg border px-3 py-2 text-sm",
                errors[field.variableName] ? "border-red-500" : "border-gray-300"
              )}
            />
          )}
          {["text", "date", "time", "datetime", "url"].includes(field.type) && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type={field.type === "url" ? "url" : field.type === "datetime" ? "datetime-local" : field.type}
                  {...register(field.variableName, { required: field.required })}
                  placeholder={field.placeholder}
                  className={clsx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors[field.variableName] ? "border-red-500" : "border-gray-300"
                  )}
                />
                {field.integrationSource === "gdrive" && (
                  <button
                    type="button"
                    onClick={() => openPicker(handleDriveSelect(field.variableName))}
                    disabled={!isApiLoaded}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-primary-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Select from Google Drive"
                  >
                    <span className="inline-block h-5 w-5 rounded bg-[#4285F4] text-center text-xs font-bold leading-5 text-white">G</span>
                    {isApiLoaded ? "Drive" : "…"}
                  </button>
                )}
              </div>
              {field.integrationSource === "gdrive" && driveError && (
                <p className="text-xs text-red-500">{driveError}</p>
              )}
            </div>
          )}
          {/* Fallback for any unknown field type from form-schema (e.g. future types) */}
          {![ "textarea", "select", "multiselect", "file", "checkbox", "number", "text", "date", "time", "datetime", "url" ].includes(field.type) && (
            <input
              type="text"
              {...register(field.variableName, { required: field.required })}
              placeholder={field.placeholder}
              className={clsx(
                "w-full rounded-lg border px-3 py-2 text-sm",
                errors[field.variableName] ? "border-red-500" : "border-gray-300"
              )}
            />
          )}
          {errors[field.variableName] && (
            <p className="mt-1 text-xs text-red-500">
              {(errors[field.variableName] as { message?: string })?.message ?? "This field is required."}
            </p>
          )}
        </div>
        );
      })}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-primary-green px-5 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? "Running…" : submitLabel}
      </button>
    </form>
  );
}
