'use client';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}) {
  return <main id="main-content" className="recovery-screen"><section className="panel"><h1>A little pause.</h1><p>We couldn’t display this page. Your saved records are still in the database.</p><button className="primary" onClick={reset}>Try again</button><a href="/">Back to overview</a></section></main>;
}
