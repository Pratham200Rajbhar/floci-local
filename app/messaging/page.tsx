"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Tabs from "@radix-ui/react-tabs";
import { MessageSquare, Send, Plus, Trash2, Radio, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createSQSQueueSchema,
  sendSQSMessageSchema,
  createSNSTopicSchema,
  publishSNSTopicSchema,
  type CreateSQSQueueInput,
  type SendSQSMessageInput,
  type CreateSNSTopicInput,
  type PublishSNSTopicInput,
} from "@/lib/validations/messaging";

interface SQSQueueItem {
  name: string;
  url: string;
  approximateNumberOfMessages: number;
  isFifo: boolean;
}

interface SNSTopicItem {
  name: string;
  topicArn: string;
  isFifo: boolean;
}

interface SQSMessageItem {
  messageId: string;
  receiptHandle: string;
  body: string;
  sentTimestamp?: string;
}

export default function MessagingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"sqs" | "sns">("sqs");

  // SQS States
  const [createQueueDialogOpen, setCreateQueueDialogOpen] = useState(false);
  const [sendQueueDialogOpen, setSendQueueDialogOpen] = useState<string | null>(null);
  const [queueToDelete, setQueueToDelete] = useState<string | null>(null);
  const [selectedQueueForMessages, setSelectedQueueForMessages] = useState<string | null>(null);

  // SNS States
  const [createTopicDialogOpen, setCreateTopicDialogOpen] = useState(false);
  const [publishTopicDialogOpen, setPublishTopicDialogOpen] = useState<string | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);

  // SQS Forms
  const {
    register: regQueue,
    handleSubmit: handleQueueSubmit,
    reset: resetQueue,
    formState: { errors: queueErrors },
  } = useForm<CreateSQSQueueInput>({
    resolver: zodResolver(createSQSQueueSchema),
    defaultValues: { isFifo: false },
  });

  const {
    register: regMsg,
    handleSubmit: handleMsgSubmit,
    reset: resetMsg,
    setValue: setMsgValue,
    formState: { errors: msgErrors },
  } = useForm<SendSQSMessageInput>({
    resolver: zodResolver(sendSQSMessageSchema),
    defaultValues: { delaySeconds: 0 },
  });

  // SNS Forms
  const {
    register: regTopic,
    handleSubmit: handleTopicSubmit,
    reset: resetTopic,
    formState: { errors: topicErrors },
  } = useForm<CreateSNSTopicInput>({
    resolver: zodResolver(createSNSTopicSchema),
    defaultValues: { isFifo: false },
  });

  const {
    register: regPublish,
    handleSubmit: handlePublishSubmit,
    reset: resetPublish,
    setValue: setPublishValue,
    formState: { errors: publishErrors },
  } = useForm<PublishSNSTopicInput>({
    resolver: zodResolver(publishSNSTopicSchema),
  });

  // Queries
  const { data: sqsData, isLoading: sqsLoading, error: sqsError, refetch: refetchSQS } = useQuery<{
    queues: SQSQueueItem[];
  }>({
    queryKey: ["sqs-queues"],
    queryFn: async () => (await fetch("/api/sqs")).json(),
  });

  const { data: snsData, isLoading: snsLoading, error: snsError, refetch: refetchSNS } = useQuery<{
    topics: SNSTopicItem[];
  }>({
    queryKey: ["sns-topics"],
    queryFn: async () => (await fetch("/api/sns")).json(),
  });

  const { data: messagesData, isLoading: msgsLoading, refetch: refetchMsgs } = useQuery<{
    messages: SQSMessageItem[];
  }>({
    queryKey: ["sqs-messages", selectedQueueForMessages],
    queryFn: async () => {
      if (!selectedQueueForMessages) return { messages: [] };
      const res = await fetch(
        `/api/sqs/messages?queueUrl=${encodeURIComponent(selectedQueueForMessages)}`
      );
      return res.json();
    },
    enabled: Boolean(selectedQueueForMessages),
  });

  // SQS Mutations
  const createQueueMutation = useMutation({
    mutationFn: async (values: CreateSQSQueueInput) => {
      const res = await fetch("/api/sqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sqs-queues"] });
      setCreateQueueDialogOpen(false);
      resetQueue();
    },
  });

  const deleteQueueMutation = useMutation({
    mutationFn: async (queueUrl: string) => {
      const res = await fetch(`/api/sqs?queueUrl=${encodeURIComponent(queueUrl)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sqs-queues"] });
      setQueueToDelete(null);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (values: SendSQSMessageInput) => {
      const res = await fetch("/api/sqs/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      setSendQueueDialogOpen(null);
      resetMsg();
      if (selectedQueueForMessages) refetchMsgs();
    },
  });

  // SNS Mutations
  const createTopicMutation = useMutation({
    mutationFn: async (values: CreateSNSTopicInput) => {
      const res = await fetch("/api/sns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sns-topics"] });
      setCreateTopicDialogOpen(false);
      resetTopic();
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicArn: string) => {
      const res = await fetch(`/api/sns?topicArn=${encodeURIComponent(topicArn)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sns-topics"] });
      setTopicToDelete(null);
    },
  });

  const publishTopicMutation = useMutation({
    mutationFn: async (values: PublishSNSTopicInput) => {
      const res = await fetch("/api/sns/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      setPublishTopicDialogOpen(null);
      resetPublish();
    },
  });

  const queues = sqsData?.queues || [];
  const topics = snsData?.topics || [];
  const receivedMessages = messagesData?.messages || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Messaging & Pub/Sub</h2>
          <p className="text-sm text-slate-500 mt-1">
            Publish and consume messages across SQS Queues and SNS Topics.
          </p>
        </div>
      </div>

      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "sqs" | "sns")}
        className="space-y-6"
      >
        <Tabs.List className="flex border-b border-slate-200 gap-6">
          <Tabs.Trigger
            value="sqs"
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "sqs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            SQS Queues ({queues.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="sns"
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "sns"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            SNS Topics ({topics.length})
          </Tabs.Trigger>
        </Tabs.List>

        {/* SQS TAB */}
        <Tabs.Content value="sqs" className="space-y-6 focus:outline-none">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-900">Queues List</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateQueueDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Queue
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchSQS()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {sqsError ? <ErrorBanner error={sqsError} onRetry={() => refetchSQS()} /> : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-0">
                  {sqsLoading ? (
                    <LoadingSpinner message="Fetching SQS queues..." />
                  ) : queues.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        title="No SQS queues"
                        description="Create a queue to send and receive messages."
                        actionLabel="Create Queue"
                        onAction={() => setCreateQueueDialogOpen(true)}
                      />
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-5">Queue Name</th>
                          <th className="py-3 px-5">Type</th>
                          <th className="py-3 px-5">Approx Messages</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queues.map((q) => {
                          const isSelected = selectedQueueForMessages === q.url;
                          return (
                            <tr
                              key={q.url}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isSelected ? "bg-blue-50/40" : ""
                              }`}
                            >
                              <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-slate-400" />
                                  <span>{q.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-xs">
                                <Badge variant={q.isFifo ? "info" : "default"}>
                                  {q.isFifo ? "FIFO" : "Standard"}
                                </Badge>
                              </td>
                              <td className="py-3.5 px-5 text-xs font-mono">
                                {q.approximateNumberOfMessages}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    variant={isSelected ? "primary" : "outline"}
                                    size="sm"
                                    className="h-8 px-2.5 text-xs"
                                    onClick={() => setSelectedQueueForMessages(q.url)}
                                  >
                                    <Inbox className="h-3.5 w-3.5 mr-1" />
                                    Poll
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs"
                                    onClick={() => {
                                      setSendQueueDialogOpen(q.url);
                                      setMsgValue("queueUrl", q.url);
                                    }}
                                  >
                                    <Send className="h-3.5 w-3.5 mr-1" />
                                    Send
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-red-600 hover:bg-red-50"
                                    onClick={() => setQueueToDelete(q.url)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Poll Messages Inspector */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Received Messages</CardTitle>
                  <CardDescription>
                    {selectedQueueForMessages
                      ? `Queue: ${selectedQueueForMessages.split("/").pop()}`
                      : "Select a queue to poll received messages"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {selectedQueueForMessages ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => refetchMsgs()}
                      isLoading={msgsLoading}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Poll Now
                    </Button>
                  ) : null}

                  {receivedMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No messages currently in flight or available.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {receivedMessages.map((msg) => (
                        <div
                          key={msg.messageId}
                          className="p-3 bg-slate-50 text-slate-800 border border-slate-200 rounded-md text-xs font-mono"
                        >
                          <div className="text-[10px] text-slate-500 mb-1 border-b border-slate-200 pb-1">
                            ID: {msg.messageId}
                          </div>
                          <pre className="whitespace-pre-wrap">{msg.body}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs.Content>

        {/* SNS TAB */}
        <Tabs.Content value="sns" className="space-y-6 focus:outline-none">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-900">Topics List</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateTopicDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Topic
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchSNS()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {snsError ? <ErrorBanner error={snsError} onRetry={() => refetchSNS()} /> : null}

          <Card>
            <CardContent className="p-0">
              {snsLoading ? (
                <LoadingSpinner message="Fetching SNS topics..." />
              ) : topics.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No SNS topics"
                    description="Create a pub/sub topic to broadcast messages."
                    actionLabel="Create Topic"
                    onAction={() => setCreateTopicDialogOpen(true)}
                  />
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-y border-slate-200 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5">Topic Name</th>
                      <th className="py-3 px-5">ARN</th>
                      <th className="py-3 px-5">Type</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topics.map((t) => (
                      <tr key={t.topicArn} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Radio className="h-4 w-4 text-slate-400" />
                            <span>{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs font-mono text-slate-600 truncate max-w-xs">
                          {t.topicArn}
                        </td>
                        <td className="py-3.5 px-5 text-xs">
                          <Badge variant={t.isFifo ? "info" : "default"}>
                            {t.isFifo ? "FIFO" : "Standard"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => {
                                setPublishTopicDialogOpen(t.topicArn);
                                setPublishValue("topicArn", t.topicArn);
                              }}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Publish
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-600 hover:bg-red-50"
                              onClick={() => setTopicToDelete(t.topicArn)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      {/* SQS Create Queue Dialog */}
      <Dialog open={createQueueDialogOpen} onOpenChange={setCreateQueueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SQS Queue</DialogTitle>
            <DialogDescription>Add a message queue to Floci.</DialogDescription>
          </DialogHeader>

          {createQueueMutation.error ? (
            <ErrorBanner error={createQueueMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleQueueSubmit((values) => createQueueMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Queue Name</label>
              <Input placeholder="my-test-queue" {...regQueue("queueName")} error={queueErrors.queueName?.message} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFifoQueue" {...regQueue("isFifo")} className="rounded border-slate-300" />
              <label htmlFor="isFifoQueue" className="text-xs text-slate-700 font-medium">FIFO Queue (First-In-First-Out)</label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateQueueDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={createQueueMutation.isPending}>Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SQS Send Message Dialog */}
      <Dialog open={Boolean(sendQueueDialogOpen)} onOpenChange={(open) => !open && setSendQueueDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test SQS Message</DialogTitle>
            <DialogDescription>Send a raw text/JSON message to the queue.</DialogDescription>
          </DialogHeader>

          {sendMessageMutation.error ? (
            <ErrorBanner error={sendMessageMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleMsgSubmit((values) => sendMessageMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body</label>
              <textarea
                {...regMsg("messageBody")}
                rows={4}
                placeholder='{"orderId": "12345", "status": "pending"}'
                className="w-full font-mono text-xs rounded-md border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {msgErrors.messageBody?.message ? (
                <p className="text-xs text-red-600 mt-1">{msgErrors.messageBody.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSendQueueDialogOpen(null)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={sendMessageMutation.isPending}>Send Message</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SNS Create Topic Dialog */}
      <Dialog open={createTopicDialogOpen} onOpenChange={setCreateTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SNS Topic</DialogTitle>
            <DialogDescription>Add a pub/sub broadcast topic to Floci.</DialogDescription>
          </DialogHeader>

          {createTopicMutation.error ? (
            <ErrorBanner error={createTopicMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handleTopicSubmit((values) => createTopicMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Topic Name</label>
              <Input placeholder="order-notifications" {...regTopic("topicName")} error={topicErrors.topicName?.message} />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFifoTopic" {...regTopic("isFifo")} className="rounded border-slate-300" />
              <label htmlFor="isFifoTopic" className="text-xs text-slate-700 font-medium">FIFO Topic</label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateTopicDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={createTopicMutation.isPending}>Create Topic</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SNS Publish Message Dialog */}
      <Dialog open={Boolean(publishTopicDialogOpen)} onOpenChange={(open) => !open && setPublishTopicDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to SNS Topic</DialogTitle>
            <DialogDescription>Broadcast a test payload to all subscribers.</DialogDescription>
          </DialogHeader>

          {publishTopicMutation.error ? (
            <ErrorBanner error={publishTopicMutation.error} className="mb-4" />
          ) : null}

          <form onSubmit={handlePublishSubmit((values) => publishTopicMutation.mutate(values))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject (Optional)</label>
              <Input placeholder="Order Processed" {...regPublish("subject")} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Content</label>
              <textarea
                {...regPublish("message")}
                rows={4}
                placeholder="Broadcast payload content"
                className="w-full font-mono text-xs rounded-md border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {publishErrors.message?.message ? (
                <p className="text-xs text-red-600 mt-1">{publishErrors.message.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPublishTopicDialogOpen(null)}>Cancel</Button>
              <Button type="submit" size="sm" isLoading={publishTopicMutation.isPending}>Publish</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Queue Confirm */}
      <ConfirmDialog
        open={Boolean(queueToDelete)}
        onOpenChange={(open) => !open && setQueueToDelete(null)}
        title="Delete SQS Queue?"
        description="Are you sure you want to permanently delete this queue and discard unconsumed messages?"
        confirmLabel="Delete Queue"
        variant="destructive"
        isLoading={deleteQueueMutation.isPending}
        onConfirm={() => queueToDelete && deleteQueueMutation.mutate(queueToDelete)}
      />

      {/* Delete Topic Confirm */}
      <ConfirmDialog
        open={Boolean(topicToDelete)}
        onOpenChange={(open) => !open && setTopicToDelete(null)}
        title="Delete SNS Topic?"
        description="Are you sure you want to delete this topic?"
        confirmLabel="Delete Topic"
        variant="destructive"
        isLoading={deleteTopicMutation.isPending}
        onConfirm={() => topicToDelete && deleteTopicMutation.mutate(topicToDelete)}
      />
    </div>
  );
}
