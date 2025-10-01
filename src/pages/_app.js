// src/pages/_app.js
import { ping } from "@/lib/healthcheck";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <h1 style={{ color: "red", fontSize: "40px" }}>HELLO FROM _app</h1>
      <div>alias healthcheck: {ping()}</div>
      <Component {...pageProps} />
    </>
  );
}
