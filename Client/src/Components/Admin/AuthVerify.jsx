import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useNavigate } from 'react-router-dom';
import { BeatLoader } from 'react-spinners';
import { useLazyGetMyProfileQuery, useRefreshTokenMutation } from '../../store/apiSlice';
import { clearCredentials, selectAccessToken, setCredentials } from '../../store/authSlice';

const AuthVerify = () => {
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const accessToken = useSelector(selectAccessToken);
    const [refreshToken] = useRefreshTokenMutation();
    const [getMyProfile] = useLazyGetMyProfileQuery();

    useEffect(() => {
        let isActive = true;

        const verifyAuthentication = async () => {
            try {
                let activeAccessToken = accessToken;

                if (!activeAccessToken) {
                    const refreshResponse = await refreshToken().unwrap();
                    activeAccessToken = refreshResponse.accessToken;
                    dispatch(setCredentials(refreshResponse));
                }

                const profile = await getMyProfile().unwrap();

                if (!isActive) return;

                dispatch(setCredentials({
                    accessToken: activeAccessToken,
                    user: profile,
                }));
                setLoading(false);
            } catch (error) {
                if (!isActive) return;
                console.error('Error verifying authentication:', error);
                dispatch(clearCredentials());
                navigate('/', { replace: true });
            }
        };

        verifyAuthentication();

        return () => {
            isActive = false;
        };
    }, [accessToken, dispatch, getMyProfile, navigate, refreshToken]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <BeatLoader color="#36d7b7" />
            </div>
        );
    }

    // If not loading and not redirected, render the outlet
    return <Outlet />;
};

export default AuthVerify;
