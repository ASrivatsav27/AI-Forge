import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef,useState } from "react";
import socket from "@/sockets/socket";


type TerminalProps = {
  projectId: string
  setPreviewPort: React.Dispatch<React.SetStateAction<string | null>>
}


const Terminal = ({projectId,setPreviewPort}:TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
 

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      convertEol: true,
      theme: {
        background: "#1e1e1e",
      },
    });
    
    const fitAddon = new FitAddon();

    termRef.current = term;

    socket.emit("terminal:connect",{projectId})

    fitAddonRef.current = fitAddon;
     
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);

    fitAddon.fit();

    term.focus();
   
    term.onData((data) => {
      socket.emit("terminal:write", data);
    });

    const handleTerminalData = (data: string) => {
      term.write(data);
    };

    socket.on("terminal:data", handleTerminalData);

    const handleResize = () => {
      fitAddon.fit();
      
    socket.emit("terminal:resize", {
       cols: term.cols,
       rows: term.rows,
     });
    };
  
    window.addEventListener("resize", handleResize);
    
    const handlePreviewReady = (port: string) => {
        console.log("Preview Ready:", port);
       setPreviewPort(port);
      };

  socket.on("preview:ready", handlePreviewReady);

 

    return () => {
      socket.emit("terminal:disconnect", { projectId });
      window.removeEventListener("resize", handleResize);
      socket.off("terminal:data", handleTerminalData);
      socket.off("preview:ready", handlePreviewReady);
      term.dispose();
    };
  }, [projectId,setPreviewPort]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full overflow-hidden"
    />
  );
};

export default Terminal;