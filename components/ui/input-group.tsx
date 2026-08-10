import { Input } from "./input";
import { Button } from "./button";

function InputGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex ${className}`}>
      {children}
    </div>
  );
}

function InputGroupInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`rounded-r-none border-r-0 ${props.className || ""}`}
    />
  );
}

function InputGroupAddon({
  children,
  align = "inline-start",
  className = "",
}: {
  children: React.ReactNode;
  align?: "inline-start" | "inline-end";
  className?: string;
}) {
  return (
    <div className={`${align === "inline-end" ? "order-1" : ""} ${className}`}>
      {children}
    </div>
  );
}

function InputGroupButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={`rounded-l-none border-l-0 ${props.className || ""}`}
    />
  );
}

export { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton };
