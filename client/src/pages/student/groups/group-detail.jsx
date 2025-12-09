import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
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
import { MessageSquare, Link2, CheckSquare2, Users, RefreshCw } from "lucide-react";
import {
  addGroupResourceService,
  addGroupTaskService,
  fetchGroupDetailsService,
  fetchGroupMessagesService,
  fetchGroupResourcesService,
  fetchGroupTasksService,
  sendGroupMessageService,
  updateGroupTaskStatusService,
} from "@/services";
import { useContext } from "react";
import { AuthContext } from "@/context/auth-context";

// Helper function to detect resource type from URL
function detectResourceType(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("drive.google.com") || lowerUrl.includes("docs.google.com")) {
    return "drive";
  }
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
    return "youtube";
  }
  if (lowerUrl.includes(".pdf") || lowerUrl.includes("pdf")) {
    return "pdf";
  }
  if (lowerUrl.includes("notion") || lowerUrl.includes("notes")) {
    return "notes";
  }
  return "link";
}

// Helper function to format date
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

function GroupDetailPage() {
  const { groupId } = useParams();
  const { auth } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [resources, setResources] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");

  const [messageText, setMessageText] = useState("");
  const [resourceForm, setResourceForm] = useState({
    title: "",
    url: "",
    type: "link",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const messagesEndRef = useRef(null);
  const chatIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function loadAll() {
    try {
      setLoading(true);
      const [groupRes, msgRes, resRes, taskRes] = await Promise.all([
        fetchGroupDetailsService(groupId),
        fetchGroupMessagesService(groupId),
        fetchGroupResourcesService(groupId),
        fetchGroupTasksService(groupId),
      ]);

      if (groupRes.success) setGroup(groupRes.data);
      if (msgRes.success) {
        setMessages(msgRes.data || []);
        setTimeout(scrollToBottom, 100);
      }
      if (resRes.success) setResources(resRes.data || []);
      if (taskRes.success) setTasks(taskRes.data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load group");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessagesOnly() {
    try {
      const msgRes = await fetchGroupMessagesService(groupId);
      if (msgRes.success) {
        setMessages(msgRes.data || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Auto-refresh chat every 5 seconds
  useEffect(() => {
    if (activeTab === "chat" && autoRefresh) {
      chatIntervalRef.current = setInterval(() => {
        loadMessagesOnly();
      }, 5000);

      return () => {
        if (chatIntervalRef.current) {
          clearInterval(chatIntervalRef.current);
        }
      };
    } else {
      if (chatIntervalRef.current) {
        clearInterval(chatIntervalRef.current);
      }
    }
  }, [activeTab, autoRefresh, groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim()) return;
    try {
      setSaving(true);
      const res = await sendGroupMessageService(groupId, { text: messageText.trim() });
      if (res.success) {
        setMessageText("");
        await loadMessagesOnly();
      } else {
        alert(res.message || "Failed to send message");
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to send message");
    } finally {
      setSaving(false);
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
        const resRes = await fetchGroupResourcesService(groupId);
        if (resRes.success) setResources(resRes.data || []);
        alert("Resource added successfully!");
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
        const taskRes = await fetchGroupTasksService(groupId);
        if (taskRes.success) setTasks(taskRes.data || []);
        alert("Task added successfully!");
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
      const res = await updateGroupTaskStatusService(groupId, taskId, {
        status: newStatus,
      });
      if (res.success) {
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
    setResourceForm((prev) => ({
      ...prev,
      url,
      type: prev.type === "link" ? detectedType : prev.type,
    }));
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
        <div className="text-center py-8 text-red-500">
          Group not found or you are not a member.
        </div>
      </div>
    );
  }

  const currentUserId = auth?.user?._id;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Group Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{group.name}</CardTitle>
              <p className="text-muted-foreground mt-1">
                {group.description || "No description"}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{group.members?.length || 0} members</span>
                </div>
                <div>Join code: <span className="font-mono font-bold">{group.joinCode}</span></div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare2 className="h-4 w-4" />
            Tasks
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Group Chat</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMessagesOnly}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button
                    variant={autoRefresh ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    Auto-refresh: {autoRefresh ? "ON" : "OFF"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 h-96 overflow-y-auto space-y-3 bg-muted/30">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwnMessage = msg.senderId?._id === currentUserId || 
                                       (typeof msg.senderId === 'string' && msg.senderId === currentUserId);
                    return (
                      <div
                        key={msg._id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border"
                          }`}
                        >
                          {!isOwnMessage && msg.senderId?.userName && (
                            <div className="font-semibold text-sm mb-1">
                              {msg.senderId.userName}
                            </div>
                          )}
                          <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {formatDate(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={saving || !messageText.trim()}>
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {resources.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No resources shared yet.
                  </div>
                ) : (
                  resources.map((res) => (
                    <div
                      key={res._id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{res.title}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                              {res.type}
                            </span>
                          </div>
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm break-all block"
                          >
                            {res.url}
                          </a>
                          {res.addedBy?.userName && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Added by {res.addedBy.userName} • {formatDate(res.createdAt)}
                            </div>
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
                    onChange={(e) =>
                      setResourceForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    required
                  />
                  <Input
                    placeholder="URL (Google Drive, YouTube, PDF, etc.)"
                    type="url"
                    value={resourceForm.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    required
                  />
                  <Select
                    value={resourceForm.type}
                    onValueChange={(value) =>
                      setResourceForm((prev) => ({ ...prev, type: value }))
                    }
                  >
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

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Group Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tasks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No tasks yet. Create your first task!
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task._id}
                      className={`border rounded-lg p-4 ${
                        task.status === "completed"
                          ? "bg-muted/30 opacity-75"
                          : "bg-background"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`font-semibold ${
                                task.status === "completed" ? "line-through" : ""
                              }`}
                            >
                              {task.title}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded uppercase ${
                                task.status === "completed"
                                  ? "bg-green-500/20 text-green-700"
                                  : "bg-yellow-500/20 text-yellow-700"
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {task.assignedBy?.userName && (
                              <span>Assigned by {task.assignedBy.userName}</span>
                            )}
                            {task.dueDate && (
                              <span className="ml-2">
                                • Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.createdAt && (
                              <span className="ml-2">• {formatDate(task.createdAt)}</span>
                            )}
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
                    onChange={(e) =>
                      setTaskForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    required
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                  <Input
                    type="date"
                    placeholder="Due date (optional)"
                    value={taskForm.dueDate}
                    onChange={(e) =>
                      setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))
                    }
                  />
                  <Button type="submit" disabled={saving} className="w-full">
                    Add Task
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GroupDetailPage;
