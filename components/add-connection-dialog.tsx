"use client"

import * as React from "react"
import { FilesError } from "files-sdk"

import {
  createConnectionId,
  type Connection,
  type ConnectionProvider,
} from "@/lib/connections"
import { createFiles } from "@/lib/files-client"
import { useConnections } from "@/lib/store/connection-store"
import { Button } from "@/components/ui/button"
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

const PROVIDER_OPTIONS: { value: ConnectionProvider; label: string }[] = [
  { value: "s3", label: "AWS S3" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "s3-compatible", label: "S3-compatible (custom endpoint)" },
]

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
  const isS3Compatible = form.provider === "s3-compatible"

  return {
    id: existing?.id ?? createConnectionId(),
    name: form.name.trim() || form.bucket.trim(),
    provider: form.provider,
    bucket: form.bucket.trim(),
    region: !isR2 ? form.region.trim() || undefined : undefined,
    endpoint: isS3Compatible ? form.endpoint.trim() || undefined : undefined,
    forcePathStyle: isS3Compatible && form.forcePathStyle,
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
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
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
  const canSubmit =
    form.bucket.trim() &&
    form.accessKeyId.trim() &&
    form.secretAccessKey.trim() &&
    (provider !== "r2" || form.accountId.trim()) &&
    (provider !== "s3-compatible" || form.endpoint.trim()) &&
    status !== "testing"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    const connection = buildConnection(form, editingConnection)
    setStatus("testing")
    setError(null)
    try {
      // Validate credentials + CORS with a tiny list before saving.
      await createFiles(connection).list({ limit: 1 })
      if (editingConnection) updateConnection(connection)
      else addConnection(connection)
      setAddDialogOpen(false)
    } catch (err) {
      if (err instanceof FilesError) {
        setError(`${err.message} (${err.code})`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Could not connect. Check the bucket, credentials, and CORS.")
      }
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
                : "Connect an S3, R2, or S3-compatible bucket. Credentials are stored in your browser only; the bucket must allow CORS."}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel>
            <form
              id="add-connection-form"
              onSubmit={handleSubmit}
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
                      {
                        PROVIDER_OPTIONS.find((o) => o.value === form.provider)
                          ?.label
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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

              <Field label="Bucket">
                <Input
                  value={form.bucket}
                  onChange={(e) => update("bucket", e.target.value)}
                  placeholder="my-bucket"
                  required
                />
              </Field>

              {provider === "r2" ? (
                <Field label="Account ID" hint="Cloudflare account id.">
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

              {provider === "s3-compatible" ? (
                <>
                  <Field
                    label="Endpoint"
                    hint="e.g. https://s3.us-west-1.wasabisys.com"
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
                    <input
                      type="checkbox"
                      checked={form.forcePathStyle}
                      onChange={(e) =>
                        update("forcePathStyle", e.target.checked)
                      }
                      className="size-4"
                    />
                    <span>Force path-style addressing (MinIO, etc.)</span>
                  </label>
                </>
              ) : null}

              <Field label="Access key ID">
                <Input
                  value={form.accessKeyId}
                  onChange={(e) => update("accessKeyId", e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="Secret access key">
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
