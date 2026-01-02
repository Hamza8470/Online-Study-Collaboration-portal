import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminStatsService,
  getAdminUsersService,
  getAdminCoursesService,
  deleteUserAdminService,
  updateUserRoleService,
  deleteCourseAdminService,
  toggleCourseStatusService,
  updateUserStatusService,
  approveCourseAdminService,
  rejectCourseAdminService,
  assignInstructorAdminService,
  editCourseAdminService,
  getAdminGroupsService,
  createAdminGroupService,
  deleteAdminGroupService,
  deleteAdminGroupMessageService,
  muteUserAdminGroupService,
  removeUserAdminGroupService,
  toggleGroupSettingsAdminService,
} from "@/services";
import { getInstructorTestsService, deleteTestService, getAllTestsAdminService } from "@/services/test-service";
import { Users, BookOpen, DollarSign, ShoppingCart, Trash2, Edit, ToggleLeft, ToggleRight, ShieldOff, ShieldCheck, Check, X, MessageCircleWarning, BellOff, Bell, ClipboardList } from "lucide-react";

function AdminDashboard() {
  const navigate = useNavigate();
  const { resetCredentials } = useContext(AuthContext);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tests, setTests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [loading, setLoading] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [moderationMessageId, setModerationMessageId] = useState("");

  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: "", id: "", name: "" });
  const [roleDialog, setRoleDialog] = useState({ open: false, userId: "", currentRole: "", newRole: "" });
  const [suspendDialog, setSuspendDialog] = useState({ open: false, userId: "", suspendedUntil: "" });

  const handleLogout = () => {
    resetCredentials();
    sessionStorage.clear();
    navigate("/auth");
  };

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchStats();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "courses") {
      fetchCourses();
    } else if (activeTab === "groups") {
      fetchGroups();
    } else if (activeTab === "tests") {
      fetchTests();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await getAdminStatsService();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getAdminUsersService();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await getAdminCoursesService();
      if (response.success) {
        setCourses(response.data);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await getAdminGroupsService();
      if (response.success) {
        setGroups(response.data);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    setLoading(true);
    try {
      const response = await getAllTestsAdminService();
      if (response.success) {
        setTests(response.data);
      }
    } catch (error) {
      console.error("Error fetching tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatus = async (userId, status) => {
    if (status === "suspended") {
      setSuspendDialog({ open: true, userId, suspendedUntil: "" });
      return;
    }
    try {
      const response = await updateUserStatusService(userId, { status });
      if (response.success) {
        toast({
          title: "Success",
          description: status === "banned" ? "User banned successfully" : "User reactivated",
        });
        fetchUsers();
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendDialog.suspendedUntil) {
      toast({
        title: "Error",
        description: "Please select a suspension end date",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await updateUserStatusService(suspendDialog.userId, {
        status: "suspended",
        suspendedUntil: suspendDialog.suspendedUntil,
      });
      if (response.success) {
        toast({
          title: "Success",
          description: "User suspended successfully",
        });
        setSuspendDialog({ open: false, userId: "", suspendedUntil: "" });
        fetchUsers();
      }
    } catch (error) {
      console.error("Error suspending user:", error);
      toast({
        title: "Error",
        description: "Failed to suspend user",
        variant: "destructive",
      });
    }
  };

  const handleCourseApprove = async (courseId) => {
    try {
      const response = await approveCourseAdminService(courseId);
      if (response.success) {
        fetchCourses();
      }
    } catch (error) {
      console.error("Error approving course:", error);
    }
  };

  const handleCourseReject = async (courseId) => {
    try {
      const notes = prompt("Reason for rejection?", "Incomplete content");
      const response = await rejectCourseAdminService(courseId, notes || "");
      if (response.success) {
        fetchCourses();
      }
    } catch (error) {
      console.error("Error rejecting course:", error);
    }
  };

  const handleAssignInstructor = async (courseId) => {
    const instructorId = prompt("Enter instructor userId to assign:");
    if (!instructorId) return;
    try {
      const response = await assignInstructorAdminService(courseId, instructorId);
      if (response.success) {
        fetchCourses();
      }
    } catch (error) {
      console.error("Error assigning instructor:", error);
    }
  };

  const handleEditCourse = async (courseId) => {
    const title = prompt("New course title (leave blank to skip):");
    const payload = {};
    if (title) payload.title = title;
    if (Object.keys(payload).length === 0) return;
    try {
      const response = await editCourseAdminService(courseId, payload);
      if (response.success) fetchCourses();
    } catch (error) {
      console.error("Error editing course:", error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name) return;
    try {
      const response = await createAdminGroupService(newGroup);
      if (response.success) {
        setNewGroup({ name: "", description: "" });
        fetchGroups();
      }
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleToggleGroupSettings = async (groupId, updates) => {
    try {
      const response = await toggleGroupSettingsAdminService(groupId, updates);
      if (response.success) fetchGroups();
    } catch (error) {
      console.error("Error updating group settings:", error);
    }
  };

  const handleMuteUser = async (groupId) => {
    const userId = prompt("User ID to mute:");
    if (!userId) return;
    const minutes = prompt("Mute duration in minutes (blank for indefinite):");
    const mutedUntil = minutes ? new Date(Date.now() + Number(minutes) * 60000) : null;
    try {
      const response = await muteUserAdminGroupService(groupId, userId, { mutedUntil });
      if (response.success) fetchGroups();
    } catch (error) {
      console.error("Error muting user:", error);
    }
  };

  const handleRemoveUser = async (groupId) => {
    const userId = prompt("User ID to remove:");
    if (!userId) return;
    const reason = prompt("Reason (optional):", "policy violation") || "";
    try {
      const response = await removeUserAdminGroupService(groupId, userId, { reason });
      if (response.success) fetchGroups();
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      const response = await deleteAdminGroupService(groupId);
      if (response.success) fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  const handleDeleteMessage = async () => {
    if (!moderationMessageId) return;
    try {
      const response = await deleteAdminGroupMessageService(moderationMessageId);
      if (response.success) {
        setModerationMessageId("");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleDeleteUser = async () => {
    try {
      const response = await deleteUserAdminService(deleteDialog.id);
      if (response.success) {
        fetchUsers();
        setDeleteDialog({ open: false, type: "", id: "", name: "" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleDeleteCourse = async () => {
    try {
      const response = await deleteCourseAdminService(deleteDialog.id);
      if (response.success) {
        fetchCourses();
        setDeleteDialog({ open: false, type: "", id: "", name: "" });
      }
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const handleUpdateRole = async () => {
    try {
      const response = await updateUserRoleService(roleDialog.userId, roleDialog.newRole);
      if (response.success) {
        fetchUsers();
        setRoleDialog({ open: false, userId: "", currentRole: "", newRole: "" });
      }
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleToggleCourseStatus = async (courseId) => {
    try {
      const response = await toggleCourseStatusService(courseId);
      if (response.success) {
        fetchCourses();
      }
    } catch (error) {
      console.error("Error toggling course status:", error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const normalizedRole = user.role === "user" ? "student" : user.role;
    const matchesSearch =
      user.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || normalizedRole === filterRole;
    return matchesSearch && matchesRole;
  });

  const filteredCourses = courses.filter((course) => {
    return (
      course.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.instructorId?.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <h3 className="text-3xl font-bold mt-2">{stats?.stats?.totalUsers || 0}</h3>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Courses</p>
              <h3 className="text-3xl font-bold mt-2">{stats?.stats?.totalCourses || 0}</h3>
            </div>
            <BookOpen className="w-12 h-12 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <h3 className="text-3xl font-bold mt-2">{stats?.stats?.totalOrders || 0}</h3>
            </div>
            <ShoppingCart className="w-12 h-12 text-orange-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <h3 className="text-3xl font-bold mt-2">${stats?.stats?.totalRevenue || 0}</h3>
            </div>
            <DollarSign className="w-12 h-12 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Role Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Instructors</span>
              <span className="font-semibold">{stats?.stats?.totalInstructors || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Students</span>
              <span className="font-semibold">{stats?.stats?.totalStudents || 0}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Recent Users</h3>
          <div className="space-y-2">
            {stats?.recentUsers?.slice(0, 5).map((user) => (
              <div key={user._id} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{user.userName}</span>
                <span className="text-gray-500 text-xs">{user.role === "user" ? "student" : user.role}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="instructor">Instructor</SelectItem>
            <SelectItem value="superadmin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{user.userName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.userEmail}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const displayRole = user.role === "user" ? "student" : user.role;
                      const badgeClass =
                        displayRole === "superadmin"
                          ? "bg-purple-100 text-purple-800"
                          : displayRole === "instructor"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800";
                      return (
                        <span className={`px-2 py-1 text-xs rounded-full ${badgeClass}`}>
                          {displayRole}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{user.status || "active"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.role === "instructor" && `${user.coursesCreated || 0} courses`}
                    {user.role === "student" && `${user.coursesEnrolled || 0} enrolled`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRoleDialog({
                            open: true,
                            userId: user._id,
                            currentRole: user.role,
                            newRole: user.role,
                          })
                        }
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserStatus(user._id, "suspended")}
                          >
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Suspends user access temporarily</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserStatus(user._id, "banned")}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Permanently bans user</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserStatus(user._id, "active")}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restore user access</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            type: "user",
                            id: user._id,
                            name: user.userName,
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderCourses = () => (
    <div className="space-y-6">
      <Input
        placeholder="Search courses by title or instructor..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approval</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCourses.map((course) => (
                <tr key={course._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{course.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {course.instructorId?.userName || course.instructorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{course.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${course.pricing}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{course.studentsCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                    {course.approvalStatus || "pending"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        course.isPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {course.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCourseApprove(course._id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Approve course for publishing</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCourseReject(course._id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reject course and unpublish</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAssignInstructor(course._id)}
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Assign a different instructor</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCourse(course._id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Quick edit course fields</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleCourseStatus(course._id)}
                      >
                        {course.isPublished ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            type: "course",
                            id: course._id,
                            name: course.title,
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderGroups = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h3 className="text-lg font-semibold">Create Group</h3>
          <Input
            placeholder="Group name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
          />
          <Input
            placeholder="Description"
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
          />
          <Button onClick={handleCreateGroup}>Create</Button>
        </Card>
        <Card className="p-4 space-y-3">
          <h3 className="text-lg font-semibold">Moderate Message</h3>
          <Input
            placeholder="Message ID to delete"
            value={moderationMessageId}
            onChange={(e) => setModerationMessageId(e.target.value)}
          />
          <Button variant="destructive" onClick={handleDeleteMessage}>Delete Message</Button>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filters</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((group) => (
                <tr key={group._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{group.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{group.joinCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{group.membersCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleToggleGroupSettings(group._id, { chatDisabled: !group.chatDisabled })
                          }
                        >
                          {group.chatDisabled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Toggle chat availability</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleGroupSettings(group._id, {
                                profanityFilterEnabled: !group.profanityFilterEnabled,
                              })
                            }
                          >
                            <MessageCircleWarning className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Toggle profanity filter</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleGroupSettings(group._id, {
                                spamFilterEnabled: !group.spamFilterEnabled,
                              })
                            }
                          >
                            <ToggleRight className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Toggle spam detection</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleMuteUser(group._id)}>
                            <BellOff className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mute user by ID</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleRemoveUser(group._id)}>
                            <Users className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove user from group</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteGroup(group._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete this group</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderTests = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Manage Tests</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-semibold text-gray-700">Title</th>
                <th className="p-4 text-left font-semibold text-gray-700">Category</th>
                <th className="p-4 text-left font-semibold text-gray-700">Difficulty</th>
                <th className="p-4 text-left font-semibold text-gray-700">Questions</th>
                <th className="p-4 text-left font-semibold text-gray-700">Created By</th>
                <th className="p-4 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-500">No tests found</td>
                </tr>
              ) : (
                tests.map((test) => (
                  <tr key={test._id} className="border-b hover:bg-gray-50">
                    <td className="p-4">{test.title}</td>
                    <td className="p-4">{test.category}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        test.difficulty === "Easy" ? "bg-green-100 text-green-800" :
                        test.difficulty === "Medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {test.difficulty}
                      </span>
                    </td>
                    <td className="p-4">{test.questions?.length || 0}</td>
                    <td className="p-4">{test.createdBy?.userName || "Unknown"}</td>
                    <td className="p-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (window.confirm(`Delete test "${test.title}"?`)) {
                                  try {
                                    const response = await deleteTestService(test._id);
                                    if (response.success) {
                                      toast({ title: "Success", description: "Test deleted successfully" });
                                      fetchTests();
                                    } else {
                                      toast({ title: "Error", description: response.message || "Failed to delete test", variant: "destructive" });
                                    }
                                  } catch (error) {
                                    console.error("Error deleting test:", error);
                                    toast({ title: "Error", description: error.response?.data?.message || "Failed to delete test", variant: "destructive" });
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete this test</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage users, courses, and monitor system statistics</p>
          </div>
          <Button className="text-black bg-red-500" variant="outline" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 border-b">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 font-medium ${
                activeTab === "dashboard"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 font-medium ${
                activeTab === "users"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("courses")}
              className={`px-4 py-2 font-medium ${
                activeTab === "courses"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Courses
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-4 py-2 font-medium ${
                activeTab === "groups"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setActiveTab("tests")}
              className={`px-4 py-2 font-medium ${
                activeTab === "tests"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Tests
            </button>
          </div>
        </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && renderDashboard()}
              {activeTab === "users" && renderUsers()}
              {activeTab === "courses" && renderCourses()}
              {activeTab === "groups" && renderGroups()}
              {activeTab === "tests" && renderTests()}
            </>
          )}
        </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteDialog.type} "{deleteDialog.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, type: "", id: "", name: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteDialog.type === "user" ? handleDeleteUser : handleDeleteCourse}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Update Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(open) => setRoleDialog({ ...roleDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update User Role</DialogTitle>
            <DialogDescription>Select a new role for this user.</DialogDescription>
          </DialogHeader>
          <Select value={roleDialog.newRole} onValueChange={(value) => setRoleDialog({ ...roleDialog, newRole: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="instructor">Instructor</SelectItem>
              <SelectItem value="superadmin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialog({ open: false, userId: "", currentRole: "", newRole: "" })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend User Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ ...suspendDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>Select the suspension end date. The user will be unable to login until this date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="suspendDate" className="text-sm font-medium">Suspension End Date</label>
            <Input
              id="suspendDate"
              type="date"
              value={suspendDialog.suspendedUntil}
              onChange={(e) => setSuspendDialog({ ...suspendDialog, suspendedUntil: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialog({ open: false, userId: "", suspendedUntil: "" })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSuspendUser}>Suspend User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default AdminDashboard;
