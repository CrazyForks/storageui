"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { toConnectionRef } from "@/lib/storage/connection-ref"
import {
  createConnectionId,
  type Connection,
  type ConnectionProvider,
} from "@/lib/storage/connections"
import { useConnections } from "@/lib/store/connection-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlibabaCloudIcon,
  AwsIcon,
  BackblazeIcon,
  CloudflareIcon,
  MinioIcon,
} from "@/components/foundations/cloud-provider-icons"
import {
  AppIcon,
  CloudServerIcon,
  Delete02Icon,
} from "@/components/foundations/icons"
import { testConnectionAction } from "@/app/actions/files"

const PROVIDER_OPTIONS: { value: ConnectionProvider; label: string }[] = [
  { value: "s3", label: "AWS S3" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "alibaba", label: "Alibaba Cloud OSS" },
  { value: "backblaze-b2", label: "Backblaze B2" },
  { value: "minio", label: "MinIO" },
  { value: "tencent", label: "Tencent Cloud COS" },
  { value: "s3-compatible", label: "S3-compatible (custom endpoint)" },
]

function ConnectionProviderIcon({
  provider,
  className,
}: {
  provider: ConnectionProvider
  className?: string
}) {
  switch (provider) {
    case "s3":
      return <AwsIcon className={className} />
    case "r2":
      return <CloudflareIcon className={className} />
    case "alibaba":
      return <AlibabaCloudIcon className={className} />
    case "backblaze-b2":
      return <BackblazeIcon className={cn(className, "w-auto")} />
    case "minio":
      return <MinioIcon className={cn(className, "rounded-[3px]")} />
    case "tencent":
      return <AppIcon icon={CloudServerIcon} className={className} />
    case "s3-compatible":
      return <AppIcon icon={CloudServerIcon} className={className} />
  }
}

function describeConnectionError(
  err: unknown,
  t: (key: string) => string
): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/\(Unauthorized\)/.test(message)) {
    return t("errorAccessDenied")
  }
  if (/\(NotFound\)/.test(message)) {
    return t("errorNotFound")
  }
  return message || t("errorGeneric")
}

type FormState = {
  name: string
  provider: ConnectionProvider
  bucket: string
  region: string
  endpoint: string
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string
  forcePathStyle: boolean
}

const EMPTY_FORM: FormState = {
  name: "",
  provider: "s3",
  bucket: "",
  region: "",
  endpoint: "",
  accountId: "",
  accessKeyId: "",
  secretAccessKey: "",
  publicBaseUrl: "",
  forcePathStyle: false,
}

function formFromConnection(connection: Connection): FormState {
  return {
    name: connection.name,
    provider: connection.provider,
    bucket: connection.bucket,
    region: connection.region ?? "",
    endpoint: connection.endpoint ?? "",
    accountId: connection.accountId ?? "",
    accessKeyId: connection.accessKeyId,
    secretAccessKey: connection.secretAccessKey,
    publicBaseUrl: connection.publicBaseUrl ?? "",
    forcePathStyle: connection.forcePathStyle ?? false,
  }
}

function buildConnection(
  form: FormState,
  existing: Connection | null
): Connection {
  const isR2 = form.provider === "r2"
  const isAlibaba = form.provider === "alibaba"
  const isBackblaze = form.provider === "backblaze-b2"
  const isMinio = form.provider === "minio"
  const isTencent = form.provider === "tencent"
  const isS3Compatible = form.provider === "s3-compatible"
  const supportsEndpointOverride =
    isS3Compatible || isAlibaba || isBackblaze || isMinio || isTencent

  return {
    id: existing?.id ?? createConnectionId(),
    name: form.name.trim() || form.bucket.trim(),
    provider: form.provider,
    bucket: form.bucket.trim(),
    region: !isR2 ? form.region.trim() || undefined : undefined,
    endpoint: supportsEndpointOverride
      ? form.endpoint.trim() || undefined
      : undefined,
    forcePathStyle: supportsEndpointOverride && form.forcePathStyle,
    accountId: isR2 ? form.accountId.trim() || undefined : undefined,
    accessKeyId: form.accessKeyId.trim(),
    secretAccessKey: form.secretAccessKey.trim(),
    publicBaseUrl: form.publicBaseUrl.trim() || undefined,
    source: "local",
  }
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}

export function AddConnectionDialog() {
  const t = useTranslations("Connection")
  const tc = useTranslations("Common")
  const {
    isAddDialogOpen,
    editingConnection,
    setAddDialogOpen,
    addConnection,
    updateConnection,
    removeConnection,
  } = useConnections()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = React.useState<"idle" | "testing">("idle")
  const [error, setError] = React.useState<string | null>(null)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  React.useEffect(() => {
    setForm(
      isAddDialogOpen && editingConnection
        ? formFromConnection(editingConnection)
        : EMPTY_FORM
    )
    setStatus("idle")
    setError(null)
  }, [editingConnection, isAddDialogOpen])

  const { provider } = form
  const selectedProvider = PROVIDER_OPTIONS.find(
    (option) => option.value === provider
  )
  const canSubmit =
    form.bucket.trim() &&
    form.accessKeyId.trim() &&
    form.secretAccessKey.trim() &&
    (provider !== "r2" || form.accountId.trim()) &&
    (provider !== "alibaba" || form.region.trim()) &&
    (provider !== "backblaze-b2" || form.region.trim()) &&
    (provider !== "tencent" || form.region.trim()) &&
    (provider !== "minio" || form.endpoint.trim()) &&
    (provider !== "s3-compatible" || form.endpoint.trim()) &&
    status !== "testing"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    const connection = buildConnection(form, editingConnection)
    setStatus("testing")
    setError(null)
    try {
      // Validate credentials + bucket with a tiny server-side list before saving.
      await testConnectionAction(toConnectionRef(connection))
      if (editingConnection) updateConnection(connection)
      else addConnection(connection)
      setAddDialogOpen(false)
    } catch (err) {
      setError(describeConnectionError(err, t))
    } finally {
      setStatus("idle")
    }
  }

  return (
    <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
      {isAddDialogOpen ? (
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingConnection ? t("editTitle") : t("addTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingConnection ? t("editDescription") : t("addDescription")}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel>
            <form
              id="add-connection-form"
              onSubmit={handleSubmit}
              onKeyDown={(event) => {
                if (
                  editingConnection &&
                  (event.metaKey || event.ctrlKey) &&
                  event.key === "Enter"
                ) {
                  event.preventDefault()
                  event.currentTarget.requestSubmit()
                }
              }}
              className="grid gap-4"
            >
              <Field label={t("provider")}>
                <Select
                  value={form.provider}
                  onValueChange={(value) => {
                    const next = value as ConnectionProvider
                    setForm((prev) => ({
                      ...prev,
                      provider: next,
                      // MinIO almost always needs path-style addressing.
                      forcePathStyle:
                        next === "minio" ? true : prev.forcePathStyle,
                    }))
                    setError(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {selectedProvider ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <ConnectionProviderIcon
                            provider={selectedProvider.value}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">
                            {selectedProvider.label}
                          </span>
                        </span>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex min-w-0 items-center gap-2">
                          <ConnectionProviderIcon
                            provider={option.value}
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">{option.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("name")} hint={t("nameHint")}>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={t("namePlaceholder")}
                />
              </Field>

              <Field label={t("bucket")} required>
                <Input
                  value={form.bucket}
                  onChange={(e) => update("bucket", e.target.value)}
                  placeholder="my-bucket"
                  required
                />
              </Field>

              {provider === "r2" ? (
                <Field
                  label={t("accountId")}
                  hint={t("accountIdHint")}
                  required
                >
                  <Input
                    value={form.accountId}
                    onChange={(e) => update("accountId", e.target.value)}
                    required
                  />
                </Field>
              ) : null}

              {provider === "s3" ? (
                <Field label={t("region")}>
                  <Input
                    value={form.region}
                    onChange={(e) => update("region", e.target.value)}
                    placeholder="us-east-1"
                  />
                </Field>
              ) : null}

              {provider === "alibaba" ? (
                <>
                  <Field
                    label={t("region")}
                    hint={t("alibabaRegionHint")}
                    required
                  >
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="cn-hangzhou"
                      required
                    />
                  </Field>
                  <Field label={t("endpoint")} hint={t("alibabaEndpointHint")}>
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="https://oss-cn-hangzhou.aliyuncs.com"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) =>
                        update("forcePathStyle", checked)
                      }
                    />
                    <span>{t("forcePathStyle")}</span>
                  </label>
                </>
              ) : null}

              {provider === "backblaze-b2" ? (
                <>
                  <Field
                    label={t("region")}
                    hint={t("backblazeRegionHint")}
                    required
                  >
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="us-west-002"
                      required
                    />
                  </Field>
                  <Field
                    label={t("endpoint")}
                    hint={t("backblazeEndpointHint")}
                  >
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="https://s3.us-west-002.backblazeb2.com"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) =>
                        update("forcePathStyle", checked)
                      }
                    />
                    <span>{t("forcePathStyle")}</span>
                  </label>
                </>
              ) : null}

              {provider === "tencent" ? (
                <>
                  <Field
                    label={t("region")}
                    hint={t("tencentRegionHint")}
                    required
                  >
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="ap-guangzhou"
                      required
                    />
                  </Field>
                  <Field label={t("endpoint")} hint={t("tencentEndpointHint")}>
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="https://cos.ap-guangzhou.myqcloud.com"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) =>
                        update("forcePathStyle", checked)
                      }
                    />
                    <span>{t("forcePathStyle")}</span>
                  </label>
                </>
              ) : null}

              {provider === "s3-compatible" ? (
                <>
                  <Field
                    label={t("endpoint")}
                    hint={t("s3cEndpointHint")}
                    required
                  >
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="https://..."
                      required
                    />
                  </Field>
                  <Field label={t("region")} hint={t("regionAutoHint")}>
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="auto"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) =>
                        update("forcePathStyle", checked)
                      }
                    />
                    <span>{t("forcePathStyleMinio")}</span>
                  </label>
                </>
              ) : null}

              {provider === "minio" ? (
                <>
                  <Field
                    label={t("endpoint")}
                    hint={t("minioEndpointHint")}
                    required
                  >
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="http://localhost:9000"
                      required
                    />
                  </Field>
                  <Field label={t("region")} hint={t("regionDefaultHint")}>
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="us-east-1"
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.forcePathStyle}
                      onCheckedChange={(checked) =>
                        update("forcePathStyle", checked)
                      }
                    />
                    <span>{t("forcePathStyle")}</span>
                  </label>
                </>
              ) : null}

              <Field
                label={
                  provider === "backblaze-b2"
                    ? t("applicationKeyId")
                    : provider === "tencent"
                      ? t("secretId")
                      : t("accessKeyId")
                }
                required
              >
                <Input
                  value={form.accessKeyId}
                  onChange={(e) => update("accessKeyId", e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>

              <Field
                label={
                  provider === "alibaba"
                    ? t("accessKeySecret")
                    : provider === "backblaze-b2"
                      ? t("applicationKey")
                      : provider === "tencent"
                        ? t("secretKey")
                        : t("secretAccessKey")
                }
                required
              >
                <Input
                  type="password"
                  value={form.secretAccessKey}
                  onChange={(e) => update("secretAccessKey", e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label={t("publicBaseUrl")} hint={t("publicBaseUrlHint")}>
                <Input
                  value={form.publicBaseUrl}
                  onChange={(e) => update("publicBaseUrl", e.target.value)}
                  placeholder="https://cdn.example.com"
                />
              </Field>

              {error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </form>
          </DialogPanel>

          <DialogFooter>
            {editingConnection ? (
              <Button
                type="button"
                variant="destructive-outline"
                className="sm:me-auto"
                onClick={() => {
                  removeConnection(editingConnection.id)
                  setAddDialogOpen(false)
                }}
              >
                <AppIcon icon={Delete02Icon} className="size-4" />
                {tc("delete")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              form="add-connection-form"
              disabled={!canSubmit}
            >
              {status === "testing"
                ? t("testing")
                : editingConnection
                  ? t("testAndUpdate")
                  : t("testAndSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
