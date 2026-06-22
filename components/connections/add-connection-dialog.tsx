"use client"

import * as React from "react"

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
    case "s3-compatible":
      return <AppIcon icon={CloudServerIcon} className={className} />
  }
}

function describeConnectionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/\(Unauthorized\)/.test(message)) {
    return "Access denied. Check the access key and secret, and that the credentials have permission to list this bucket."
  }
  if (/\(NotFound\)/.test(message)) {
    return "Bucket not found. Check the bucket name, and the region or endpoint."
  }
  return (
    message ||
    "Could not connect. Check the bucket, credentials, and region/endpoint."
  )
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
  const isS3Compatible = form.provider === "s3-compatible"
  const supportsEndpointOverride = isS3Compatible || isAlibaba || isBackblaze

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
      setError(describeConnectionError(err))
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
              {editingConnection ? "Edit connection" : "Add connection"}
            </DialogTitle>
            <DialogDescription>
              {editingConnection
                ? "Update this connection and test it before saving."
                : "Connect an S3, R2, Alibaba OSS, Backblaze B2, or S3-compatible bucket. Credentials are stored in your browser only; the bucket must allow CORS."}
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
              <Field label="Provider">
                <Select
                  value={form.provider}
                  onValueChange={(value) =>
                    update("provider", value as ConnectionProvider)
                  }
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

              <Field
                label="Name"
                hint="Shown in the sidebar. Defaults to the bucket name."
              >
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="My bucket"
                />
              </Field>

              <Field label="Bucket" required>
                <Input
                  value={form.bucket}
                  onChange={(e) => update("bucket", e.target.value)}
                  placeholder="my-bucket"
                  required
                />
              </Field>

              {provider === "r2" ? (
                <Field
                  label="Account ID"
                  hint="Cloudflare account id."
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
                <Field label="Region">
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
                    label="Region"
                    hint="Alibaba OSS region code, without the “oss-” prefix."
                    required
                  >
                    <Input
                      value={form.region}
                      onChange={(e) => update("region", e.target.value)}
                      placeholder="cn-hangzhou"
                      required
                    />
                  </Field>
                  <Field
                    label="Endpoint"
                    hint="Optional. Defaults to https://oss-{region}.aliyuncs.com."
                  >
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
                    <span>Force path-style addressing</span>
                  </label>
                </>
              ) : null}

              {provider === "backblaze-b2" ? (
                <>
                  <Field
                    label="Region"
                    hint="B2 cluster code shown next to the bucket endpoint."
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
                    label="Endpoint"
                    hint="Optional. Defaults to https://s3.{region}.backblazeb2.com."
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
                    <span>Force path-style addressing</span>
                  </label>
                </>
              ) : null}

              {provider === "s3-compatible" ? (
                <>
                  <Field
                    label="Endpoint"
                    hint="e.g. https://s3.us-west-1.wasabisys.com"
                    required
                  >
                    <Input
                      value={form.endpoint}
                      onChange={(e) => update("endpoint", e.target.value)}
                      placeholder="https://..."
                      required
                    />
                  </Field>
                  <Field label="Region" hint="Optional. Defaults to “auto”.">
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
                    <span>Force path-style addressing (MinIO, etc.)</span>
                  </label>
                </>
              ) : null}

              <Field
                label={
                  provider === "backblaze-b2"
                    ? "Application key ID"
                    : "Access key ID"
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
                    ? "AccessKey secret"
                    : provider === "backblaze-b2"
                      ? "Application key"
                      : "Secret access key"
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

              <Field
                label="Public base URL"
                hint="Optional. A CDN/public origin; when set, file URLs skip signing."
              >
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
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-connection-form"
              disabled={!canSubmit}
            >
              {status === "testing"
                ? "Testing…"
                : editingConnection
                  ? "Test & Update"
                  : "Test & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
