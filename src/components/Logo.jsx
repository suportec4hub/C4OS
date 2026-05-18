export default function Logo({ size = 32 }) {
  return (
    <img
      src="/logo.png"
      alt="C4 OS Logo"
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
