import { useNavigate } from "react-router-dom";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, } from "@/components/ui/card";
import { useProject } from "@/hooks/useProject";
import { Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState,useEffect} from "react";


export default function Dashboard() {
  const navigate = useNavigate();
  const { handleCreateProject,handleGetAllProjects,projects } = useProject()
  const [name, setName] = useState("");
  
  useEffect(() => {
    const fetchProjects = async () => {
    await handleGetAllProjects();
   };

  fetchProjects();
   }, []);
  


  const { data: session, isPending } = authClient.useSession();

  async function handleLogout() {
    await authClient.signOut();

    navigate("/login");
  }
 
  async function handleSubmit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await handleCreateProject({name})
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

return (
  <div className="min-h-screen bg-black text-white">
    {/* Top Navbar */}
    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Create Project</Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
          <Input placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Button  type="submit">Create</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Button variant="destructive" onClick={handleLogout}>
        Logout
      </Button>
    </div>

    {/* Dashboard Content */}
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold">Your Projects</h1>
          <div className="grid gap-4">
  {projects.map((project) => (
    <Card key={project.id}>
      <CardHeader>
        <h2>{project.name}</h2>
      </CardHeader>

      <CardContent>
        <Button onClick={() => navigate(`/workspace/${project.id}`)}>
          Open
        </Button>
      </CardContent>
    </Card>
  ))}
</div>
    </div>
  </div>
);
}