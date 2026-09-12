import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <div className="app-launch" aria-hidden="true">
        <div className="app-launch-mark">
          <div className="app-launch-square app-launch-square-outer" />
          <div className="app-launch-square app-launch-square-mid" />
          <div className="app-launch-square app-launch-square-inner" />
        </div>
        <span className="app-launch-name">XSFX</span>
        <span className="app-launch-credit">BY XS.TOPHER</span>
      </div>
    </>
  );
}
