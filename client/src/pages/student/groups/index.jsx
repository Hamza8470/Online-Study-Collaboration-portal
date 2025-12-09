import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createGroupService,
  fetchMyGroupsService,
  joinGroupService,
} from "@/services";

function StudentGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [joinCode, setJoinCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadGroups() {
    try {
      const res = await fetchMyGroupsService();
      if (res.success) {
        setGroups(res.data || []);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!createForm.name.trim()) {
      alert("Group name is required");
      return;
    }
    try {
      setSaving(true);
      const res = await createGroupService(createForm);
      if (res.success) {
        setCreateForm({ name: "", description: "" });
        await loadGroups();
      } else {
        alert(res.message || "Failed to create group");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to create group");
    } finally {
      setSaving(false);
    }
  }

  async function handleJoinGroup(e) {
    e.preventDefault();
    if (!joinCode.trim() && !inviteToken.trim()) {
      alert("Provide a join code or invite token");
      return;
    }
    try {
      setSaving(true);
      const res = await joinGroupService({
        joinCode: joinCode.trim() || undefined,
        inviteToken: inviteToken.trim() || undefined,
      });
      if (res.success) {
        setJoinCode("");
        setInviteToken("");
        await loadGroups();
      } else {
        alert(res.message || "Failed to join group");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to join group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Study Groups</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Create a group</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleCreateGroup}>
              <Input
                placeholder="Group name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                placeholder="Description (optional)"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join with code or invite</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleJoinGroup}>
              <Input
                placeholder="Join code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <Input
                placeholder="Invite token (optional)"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Joining..." : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your groups</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">You are not in any groups yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {groups.map((group) => (
                <div
                  key={group._id}
                  className="border rounded p-3 flex items-start justify-between"
                >
                  <div>
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.description || "No description"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Join code: {group.joinCode}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => navigate(`/groups/${group._id}`)}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StudentGroupsPage;

