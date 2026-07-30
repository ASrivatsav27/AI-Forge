import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef } from "react";
import socket from "@/sockets/socket";

const Terminal = () => {
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
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.off("terminal:data", handleTerminalData);
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full overflow-hidden"
    />
  );
};

export default Terminal;