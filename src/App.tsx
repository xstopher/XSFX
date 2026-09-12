import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  const [launchComplete, setLaunchComplete] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLaunchComplete(true);
    }
  }, []);

  return (
    <>
      {launchComplete && <RouterProvider router={router} />}
      {!launchComplete && <div className="app-launch" onAnimationEnd={event => {
        if (event.animationName === 'launchFade') setLaunchComplete(true);
      }} aria-hidden="true">
        <div className="app-launch-mark">
          <div className="app-launch-square app-launch-square-outer" />
          <div className="app-launch-square app-launch-square-mid" />
          <div className="app-launch-square app-launch-square-inner" />
        </div>
        <span className="app-launch-name">XSFX</span>
        <span className="app-launch-credit">BY XS.TOPHER</span>
      </div>}
    </>
  );
}
