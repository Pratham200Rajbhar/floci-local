"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Plus, Send, Trash2, CheckCircle2, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  verifyEmailIdentitySchema,
  sendEmailSchema,
  type VerifyEmailIdentityInput,
  type SendEmailInput,
} from "@/lib/validations/ses";
import { formatDate } from "@/lib/utils";

interface SESIdentityItem {
  email: string;
  status: string;
}

interface CapturedEmailItem {
  id: string;
  source: string;
  destination: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  timestamp: string;
}

export default function SESPage() {
  const queryClient = useQueryClient();
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [identityToDelete, setIdentityToDelete] = useState<string | null>(null);
  const [selectedCapturedEmail, setSelectedCapturedEmail] = useState<CapturedEmailItem | null>(null);

  // Forms
  const {
    register: regVerify,
    handleSubmit: handleVerifySubmit,
    reset: resetVerify,
    formState: { errors: verifyErrors },
  } = useForm<VerifyEmailIdentityInput>({
    resolver: zodResolver(verifyEmailIdentitySchema),
  });

  const {
    register: regSend,
    handleSubmit: handleSendSubmit,
    reset: resetSend,
    setValue: setSendValue,
    formState: { errors: sendErrors },
  } = useForm<SendEmailInput>({
    resolver: zodResolver(sendEmailSchema),
  });

  // Queries
  const { data: identitiesData, isLoading: identitiesLoading, error: identitiesError, refetch: refetchIdentities } = useQuery<{
    identities: SESIdentityItem[];
  }>({
    queryKey: ["ses-identities"],
    queryFn: async () => (await fetch("/api/ses")).json(),
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery<{
    messages: CapturedEmailItem[];
  }>({
    queryKey: ["ses-messages"],
    queryFn: async () => (await fetch("/api/ses/messages")).json(),
    refetchInterval: 5000,
  });

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: async (values: VerifyEmailIdentityInput) => {
      const res = await fetch("/api/ses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ses-identities"] });
      setVerifyDialogOpen(false);
      resetVerify();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const res = await fetch(`/api/ses?emailAddress=${encodeURIComponent(emailAddress)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ses-identities"] });
      setIdentityToDelete(null);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (values: SendEmailInput) => {
      const res = await fetch("/api/ses/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      setSendEmailDialogOpen(false);
      resetSend();
      refetchMessages();
    },
  });

  const identities = identitiesData?.identities || [];
  const capturedMessages = messagesData?.messages || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">SES Email Service</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage sender identities, send test emails, and inspect captured messages in local inbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setSendEmailDialogOpen(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Send Test Email
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVerifyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Verify Identity
          </Button>
        </div>
      </div>

      {identitiesError ? <ErrorBanner error={identitiesError} onRetry={() => refetchIdentities()} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verified Identities */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Identities ({identities.length})</CardTitle>
                <CardDescription>Verified sender email addresses</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {identitiesLoading ? (
                <LoadingSpinner message="Fetching SES identities..." />
              ) : identities.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No verified identities"
                    description="Verify an email address to send test emails."
                    actionLabel="Verify Email"
                    onAction={() => setVerifyDialogOpen(true)}
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {identities.map((item) => (
                    <div
                      key={item.email}
                      className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/70 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-mono text-slate-900 truncate">{item.email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-blue-600"
                          onClick={() => {
                            setSendValue("source", item.email);
                            setSendEmailDialogOpen(true);
                          }}
                        >
                          Send
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-red-600"
                          onClick={() => setIdentityToDelete(item.email)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Captured Inbox Viewer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>Floci Captured Inbox</CardTitle>
                  <CardDescription>Live inspection of emails intercepted by Floci</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchMessages()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {messagesLoading ? (
                <LoadingSpinner message="Checking captured emails..." />
              ) : capturedMessages.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="Inbox is empty"
                    description="Send a test email using the button above to view captured messages."
                    icon={<Mail className="h-6 w-6" />}
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {capturedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedCapturedEmail(msg)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800">
                          From: {msg.source} &rarr; To: {msg.destination?.join(", ")}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatDate(msg.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900">{msg.subject}</div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {msg.bodyText || msg.bodyHtml || "(No content)"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Verify Email Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Email Identity</DialogTitle>
            <DialogDescription>
              Register an email identity with the local SES emulator.
            </DialogDescription>
          </DialogHeader>

          {verifyMutation.error ? (
            <ErrorBanner error={verifyMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleVerifySubmit((values) => verifyMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <Input placeholder="sender@example.com" {...regVerify("emailAddress")} error={verifyErrors.emailAddress?.message} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={verifyMutation.isPending}>Verify</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={sendEmailDialogOpen} onOpenChange={setSendEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send an email via SES. Floci intercepts and logs the delivery locally.
            </DialogDescription>
          </DialogHeader>

          {sendEmailMutation.error ? (
            <ErrorBanner error={sendEmailMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleSendSubmit((values) => sendEmailMutation.mutate(values))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email</label>
                <Input placeholder="sender@example.com" {...regSend("source")} error={sendErrors.source?.message} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Email</label>
                <Input placeholder="user@example.com" {...regSend("destination")} error={sendErrors.destination?.message} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <Input placeholder="Welcome to Floci!" {...regSend("subject")} error={sendErrors.subject?.message} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Body Text</label>
              <textarea
                {...regSend("bodyText")}
                rows={4}
                placeholder="This is a test notification email sent via Floci."
                className="w-full text-xs rounded-md border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {sendErrors.bodyText?.message ? (
                <p className="text-xs text-red-600 mt-1">{sendErrors.bodyText.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSendEmailDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={sendEmailMutation.isPending}>Send Email</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Captured Email Detail Dialog */}
      <Dialog open={Boolean(selectedCapturedEmail)} onOpenChange={(open) => !open && setSelectedCapturedEmail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCapturedEmail?.subject || "Captured Email"}</DialogTitle>
            <DialogDescription>
              From {selectedCapturedEmail?.source} to {selectedCapturedEmail?.destination?.join(", ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs text-slate-500 font-mono">
              Timestamp: {selectedCapturedEmail?.timestamp ? formatDate(selectedCapturedEmail.timestamp) : ""}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 whitespace-pre-wrap font-mono">
              {selectedCapturedEmail?.bodyText || selectedCapturedEmail?.bodyHtml || "(Empty email body)"}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Identity Confirm */}
      <ConfirmDialog
        open={Boolean(identityToDelete)}
        onOpenChange={(open) => !open && setIdentityToDelete(null)}
        title="Remove Email Identity?"
        description="Are you sure you want to remove this verified email identity from SES?"
        confirmLabel="Remove Identity"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => identityToDelete && deleteMutation.mutate(identityToDelete)}
      />
    </div>
  );
}
