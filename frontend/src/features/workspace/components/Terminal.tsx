import { Terminal as XTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import socket from "@/sockets/socket";

const Terminal = () => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      rows: 30,
      cols: 80,
    });

    termRef.current = term;

    term.open(terminalRef.current);
    term.focus();

    term.onData((data) => {
      socket.emit("terminal:write", data);
    });

    const handleTerminalData = (data: string) => {
      term.write(data);
    };

    socket.on("terminal:data", handleTerminalData);

    return () => {
      socket.off("terminal:data", handleTerminalData);
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  );
};

export default Terminal;