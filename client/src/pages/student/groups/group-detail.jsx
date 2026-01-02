import { useEffect, useRef, useState, useContext } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Link2, CheckSquare2, Users, BarChart3, Wifi, WifiOff, FileText, Download } from "lucide-react";
import {
  addGroupResourceService,
  addGroupTaskService,
  fetchGroupDetailsService,
  fetchGroupMessagesService,
  fetchGroupResourcesService,
  fetchGroupTasksService,
  updateGroupTaskStatusService,
  uploadGroupFileService,
  fetchGroupFilesService,
  createGroupPollService,
  fetchGroupPollsService,
  voteGroupPollService,
  leaveGroupService,
  deleteGroupService,
} from "@/services";
import { AuthContext } from "@/context/auth-context";
import { useSocket } from "@/hooks/useSocket";

function detectResourceType(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("drive.google.com") || lowerUrl.includes("docs.google.com")) return "drive";
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) return "youtube";
  if (lowerUrl.includes(".pdf") || lowerUrl.includes("pdf")) return "pdf";
  if (lowerUrl.includes("notion") || lowerUrl.includes("notes")) return "notes";
  return "link";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getInitials(name = "?") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0]?.toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  );
}

function GroupDetailPage() {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [resources, setResources] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const [messageText, setMessageText] = useState("");
  const [resourceForm, setResourceForm] = useState({ title: "", url: "", type: "link" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", dueDate: "" });
  const [pollForm, setPollForm] = useState({ question: "", options: ["", ""], expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const { socket, isConnected, onlineMembers } = useSocket(groupId);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  async function loadAll() {
    try {
      setLoading(true);
      const [groupRes, msgRes, resRes, taskRes, filesRes, pollsRes] = await Promise.all([
        fetchGroupDetailsService(groupId),
        fetchGroupMessagesService(groupId),
        fetchGroupResourcesService(groupId),
        fetchGroupTasksService(groupId),
        fetchGroupFilesService(groupId),
        fetchGroupPollsService(groupId),
      ]);

      if (groupRes.success) setGroup(groupRes.data);
      if (msgRes.success) {
        setMessages(msgRes.data || []);
        setTimeout(scrollToBottom, 100);
      }
      if (resRes.success) setResources(resRes.data || []);
      if (taskRes.success) setTasks(taskRes.data || []);
      if (filesRes.success) setFiles(filesRes.data || []);
      if (pollsRes.success) setPolls(pollsRes.data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load group");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (!socket) return;

    socket.on("new-message", (data) => {
      setMessages((prev) => [...prev, data.message]);
      setTimeout(scrollToBottom, 100);
    });

    socket.on("resource-added", (data) => setResources((prev) => [data.resource, ...prev]));
    socket.on("task-added", (data) => setTasks((prev) => [data.task, ...prev]));
    socket.on("task-status-changed", (data) => {
      setTasks((prev) => prev.map((task) => (task._id === data.taskId ? { ...task, status: data.status } : task)));
    });

    socket.on("user-typing", (data) => {
      if (data.userId === auth?.user?._id) return;
      setTypingUsers((prev) => {
        if (data.isTyping) return prev.includes(data.userName) ? prev : [...prev, data.userName];
        return prev.filter((name) => name !== data.userName);
      });
    });

    return () => {
      socket.off("new-message");
      socket.off("resource-added");
      socket.off("task-added");
      socket.off("task-status-changed");
      socket.off("user-typing");
    };
  }, [socket, auth?.user?._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function handleTyping() {
    if (!socket || !isTyping) {
      setIsTyping(true);
      socket?.emit("typing", { groupId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket?.emit("typing", { groupId, isTyping: false });
    }, 1000);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !socket) return;
    try {
      socket.emit("send-message", { groupId, text: messageText.trim() });
      setMessageText("");
      setIsTyping(false);
      socket.emit("typing", { groupId, isTyping: false });
    } catch (error) {
      console.error(error);
      alert("Failed to send message");
    }
  }

  async function handleAddResource(e) {
    e.preventDefault();
    if (!resourceForm.title.trim() || !resourceForm.url.trim()) return;
    try {
      setSaving(true);
      const detectedType = detectResourceType(resourceForm.url);
      const res = await addGroupResourceService(groupId, {
        ...resourceForm,
        type: resourceForm.type === "link" ? detectedType : resourceForm.type,
        title: resourceForm.title.trim(),
        url: resourceForm.url.trim(),
      });
      if (res.success) {
        setResourceForm({ title: "", url: "", type: "link" });
        socket?.emit("new-resource", { groupId, resource: res.data });
        const resRes = await fetchGroupResourcesService(groupId);
        if (resRes.success) setResources(resRes.data || []);
      } else {
        alert(res.message || "Failed to add resource");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to add resource");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      setSaving(true);
      const res = await addGroupTaskService(groupId, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        dueDate: taskForm.dueDate || undefined,
      });
      if (res.success) {
        setTaskForm({ title: "", description: "", dueDate: "" });
        socket?.emit("new-task", { groupId, task: res.data });
        const taskRes = await fetchGroupTasksService(groupId);
        if (taskRes.success) setTasks(taskRes.data || []);
      } else {
        alert(res.message || "Failed to add task");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to add task");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTaskStatus(taskId, currentStatus) {
    try {
      setSaving(true);
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      const res = await updateGroupTaskStatusService(groupId, taskId, { status: newStatus });
      if (res.success) {
        socket?.emit("task-updated", { groupId, taskId, status: newStatus });
        const taskRes = await fetchGroupTasksService(groupId);
        if (taskRes.success) setTasks(taskRes.data || []);
      } else {
        alert(res.message || "Failed to update task");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  function handleUrlChange(url) {
    const detectedType = detectResourceType(url);
    setResourceForm((prev) => ({ ...prev, url, type: prev.type === "link" ? detectedType : prev.type }));
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }
    setSelectedFile(file);
  }

  async function handleFileUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      setFileUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("description", "");
      const res = await uploadGroupFileService(groupId, formData);
      if (res.success) {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        const filesRes = await fetchGroupFilesService(groupId);
        if (filesRes.success) setFiles(filesRes.data || []);
        alert("File uploaded successfully!");
      } else {
        alert(res.message || "Failed to upload file");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to upload file");
    } finally {
      setFileUploading(false);
    }
  }

  function handleDownloadFile(file) {
    const url = `http://localhost:5000${file.filePath}`;
    window.open(url, "_blank");
  }

  function addPollOption() {
    setPollForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
  }

  function removePollOption(index) {
    setPollForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  }

  function updatePollOption(index, value) {
    setPollForm((prev) => ({ ...prev, options: prev.options.map((opt, i) => (i === index ? value : opt)) }));
  }

  async function handleCreatePoll(e) {
    e.preventDefault();
    if (!pollForm.question.trim() || pollForm.options.filter((o) => o.trim()).length < 2) {
      alert("Question and at least 2 options are required");
      return;
    }
    try {
      setSaving(true);
      const res = await createGroupPollService(groupId, {
        question: pollForm.question.trim(),
        options: pollForm.options.filter((o) => o.trim()),
        expiresAt: pollForm.expiresAt || undefined,
      });
      if (res.success) {
        setPollForm({ question: "", options: ["", ""], expiresAt: "" });
        const pollsRes = await fetchGroupPollsService(groupId);
        if (pollsRes.success) setPolls(pollsRes.data || []);
        alert("Poll created successfully!");
      } else {
        alert(res.message || "Failed to create poll");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to create poll");
    } finally {
      setSaving(false);
    }
  }

  async function handleVotePoll(pollId, optionIndex) {
    try {
      const res = await voteGroupPollService(groupId, pollId, { optionIndex });
      if (res.success) {
        const pollsRes = await fetchGroupPollsService(groupId);
        if (pollsRes.success) setPolls(pollsRes.data || []);
      } else {
        alert(res.message || "Failed to vote");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to vote");
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-8">Loading group...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-8 text-red-500">Group not found or you are not a member.</div>
      </div>
    );
  }

  const currentUserId = auth?.user?._id;
  const isInstructorContext = location.pathname.startsWith("/instructor");

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-rose-50">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isInstructorContext ? "/instructor?tab=messages" : "/groups")}
          >
             Back
          </Button>
        </div>

        <Card className="border shadow-sm bg-white/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-2xl font-extrabold">{group.name}</CardTitle>
                  {isConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" title="Connected" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" title="Disconnected" />
                  )}
                </div>
                <p className="text-muted-foreground mt-1 leading-relaxed">{group.description || "No description"}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{group.members?.length || 0} members  {onlineMembers.length} online</span>
                  </div>
                  <div>
                    Join code: <span className="font-mono font-bold">{group.joinCode}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {String(group.createdBy) === String(currentUserId) ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!window.confirm("Delete this group? This action cannot be undone.")) return;
                      try {
                        const res = await deleteGroupService(groupId);
                        if (res.success) {
                          alert("Group deleted");
                          navigate("/groups");
                        } else {
                          alert(res.message || "Failed to delete group");
                        }
                      } catch (err) {
                        console.error(err);
                        alert(err?.response?.data?.message || "Failed to delete group");
                      }
                    }}
                  >
                    Delete Group
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!window.confirm("Leave this group? You will lose access to group content.")) return;
                      try {
                        const res = await leaveGroupService(groupId);
                        if (res.success) {
                          alert("You have left the group");
                          navigate("/groups");
                        } else {
                          alert(res.message || "Failed to leave group");
                        }
                      } catch (err) {
                        console.error(err);
                        alert(err?.response?.data?.message || "Failed to leave group");
                      }
                    }}
                  >
                    Leave Group
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/90">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <CheckSquare2 className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="polls" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Polls
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4">
            <Card className="border shadow-sm bg-white/80 backdrop-blur">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Group Chat</CardTitle>
                  <span className="text-xs text-muted-foreground">{isConnected ? "Live syncing" : "Connecting..."}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-2xl p-4 h-96 overflow-y-auto space-y-3 flex flex-col bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.08),_transparent_35%),_radial-gradient(circle_at_bottom,_rgba(236,72,153,0.08),_transparent_35%)]">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</div>
                  ) : (
                    messages.map((msg) => {
                      const isOwnMessage =
                        msg.senderId?._id === currentUserId ||
                        (typeof msg.senderId === "string" && msg.senderId === currentUserId);
                      const senderName = msg.senderId?.userName || "Member";
                      return (
                        <div key={msg._id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                          {!isOwnMessage && (
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center mr-2">
                              {getInitials(senderName)}
                            </div>
                          )}
                          <div className={`max-w-[72%] rounded-2xl p-3 shadow-sm border ${isOwnMessage ? "bg-indigo-600 text-white ml-12" : "bg-white"}`}>
                            {!isOwnMessage && <div className="font-semibold text-sm mb-1">{senderName}</div>}
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                            <div className={`text-[11px] mt-1 ${isOwnMessage ? "text-indigo-100/80" : "text-muted-foreground"}`}>
                              {formatDate(msg.createdAt)}
                            </div>
                          </div>
                          {isOwnMessage && (
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center ml-2">
                              {getInitials(auth?.user?.userName)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {typingUsers.length > 0 && (
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground italic bg-white/70 px-3 py-1 rounded-full border shadow-sm">
                      {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center bg-white rounded-full border px-3 py-2 shadow-sm">
                  <Input
                    placeholder={isConnected ? "Send a quick update..." : "Connecting..."}
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      handleTyping();
                    }}
                    className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={!isConnected}
                  />
                  <Button type="submit" disabled={!isConnected || !messageText.trim()} className="rounded-full px-4">
                    Send
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Shared Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {resources.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No resources shared yet.</div>
                  ) : (
                    resources.map((res) => (
                      <div key={res._id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{res.title}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{res.type}</span>
                            </div>
                            <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all block">
                              {res.url}
                            </a>
                            {res.addedBy?.userName && (
                              <div className="text-xs text-muted-foreground mt-1">Added by {res.addedBy.userName}  {formatDate(res.createdAt)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Add New Resource</h3>
                  <form onSubmit={handleAddResource} className="space-y-3">
                    <Input
                      placeholder="Resource title (e.g., DBMS Notes Unit 1)"
                      value={resourceForm.title}
                      onChange={(e) => setResourceForm((prev) => ({ ...prev, title: e.target.value }))}
                      required
                    />
                    <Input
                      placeholder="URL (Google Drive, YouTube, PDF, etc.)"
                      type="url"
                      value={resourceForm.url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      required
                    />
                    <Select value={resourceForm.type} onValueChange={(value) => setResourceForm((prev) => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drive">Google Drive</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="link">Other Link</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="submit" disabled={saving} className="w-full">
                      Add Resource
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Group Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {files.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No files uploaded yet.</div>
                  ) : (
                    files.map((file) => (
                      <div key={file._id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold mb-1">{file.originalName}</div>
                            <div className="text-sm text-muted-foreground">{formatFileSize(file.fileSize)}  {file.mimeType}</div>
                            {file.uploadedBy?.userName && (
                              <div className="text-xs text-muted-foreground mt-1">Uploaded by {file.uploadedBy.userName}  {formatDate(file.createdAt)}</div>
                            )}
                          </div>
                          <Button size="sm" onClick={() => handleDownloadFile(file)} className="flex items-center gap-1">
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Upload File</h3>
                  <form onSubmit={handleFileUpload} className="space-y-3">
                    <Input ref={fileInputRef} type="file" onChange={handleFileSelect} className="cursor-pointer" />
                    {selectedFile && (
                      <div className="text-sm text-muted-foreground">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</div>
                    )}
                    <Button type="submit" disabled={fileUploading || !selectedFile} className="w-full">
                      {fileUploading ? "Uploading..." : "Upload File"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Group Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No tasks yet. Create your first task!</div>
                  ) : (
                    tasks.map((task) => (
                      <div key={task._id} className={`border rounded-lg p-4 ${task.status === "completed" ? "bg-muted/30 opacity-75" : "bg-background"}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-semibold ${task.status === "completed" ? "line-through" : ""}`}>{task.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded uppercase ${task.status === "completed" ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"}`}>
                                {task.status}
                              </span>
                            </div>
                            {task.description && <p className="text-sm text-muted-foreground mb-2">{task.description}</p>}
                            <div className="text-xs text-muted-foreground">
                              {task.assignedBy?.userName && <span>Assigned by {task.assignedBy.userName}</span>}
                              {task.dueDate && <span className="ml-2"> Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                              {task.createdAt && <span className="ml-2"> {formatDate(task.createdAt)}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={task.status === "completed" ? "secondary" : "default"}
                            onClick={() => toggleTaskStatus(task._id, task.status)}
                            disabled={saving}
                          >
                            {task.status === "completed" ? "Mark Pending" : "Mark Complete"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Create New Task</h3>
                  <form onSubmit={handleAddTask} className="space-y-3">
                    <Input
                      placeholder="Task title (e.g., Complete Unit 1 by Friday)"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                      required
                    />
                    <Textarea
                      placeholder="Description (optional)"
                      value={taskForm.description}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                    <Input
                      type="date"
                      placeholder="Due date (optional)"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                    <Button type="submit" disabled={saving} className="w-full">
                      Add Task
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="polls" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Polls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {polls.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No polls yet. Create one to gather opinions!</div>
                  ) : (
                    polls.map((poll) => {
                      const totalVotes = poll.options.reduce((sum, option) => sum + (option.votes?.length || 0), 0);
                      const userVoted = poll.options.some((opt) => opt.votes?.some((v) => String(v) === String(currentUserId)));
                      return (
                        <div key={poll._id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-semibold mb-1">{poll.question}</div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {formatDate(poll.createdAt)}
                                {poll.expiresAt && `  Expires ${new Date(poll.expiresAt).toLocaleDateString()}`}
                              </div>
                              <div className="space-y-2">
                                {poll.options.map((option, idx) => {
                                  const votes = option.votes?.length || 0;
                                  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                  const isVoted = option.votes?.some((v) => String(v) === String(currentUserId));
                                  return (
                                    <div key={idx} className="space-y-1">
                                      <div className="flex items-center justify-between text-sm">
                                        <span>{option.text}</span>
                                        <span className="text-xs text-muted-foreground">{votes} vote{votes !== 1 ? "s" : ""}</span>
                                      </div>
                                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{percentage.toFixed(0)}%</span>
                                        {isVoted && <span className="text-primary">Your vote</span>}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => handleVotePoll(poll._id, idx)}
                                        disabled={userVoted}
                                      >
                                        {userVoted ? "Voted" : "Vote"}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Create a Poll</h3>
                  <form onSubmit={handleCreatePoll} className="space-y-3">
                    <Input
                      placeholder="Poll question"
                      value={pollForm.question}
                      onChange={(e) => setPollForm((prev) => ({ ...prev, question: e.target.value }))}
                      required
                    />
                    <div className="space-y-2">
                      {pollForm.options.map((option, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input value={option} placeholder={`Option ${idx + 1}`} onChange={(e) => updatePollOption(idx, e.target.value)} required />
                          {pollForm.options.length > 2 && (
                            <Button type="button" variant="ghost" onClick={() => removePollOption(idx)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addPollOption} className="w-full">
                        Add Option
                      </Button>
                    </div>
                    <Input
                      type="datetime-local"
                      placeholder="Expires at (optional)"
                      value={pollForm.expiresAt}
                      onChange={(e) => setPollForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    />
                    <Button type="submit" disabled={saving} className="w-full">
                      Create Poll
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default GroupDetailPage;
