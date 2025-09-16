import axios, { AxiosInstance } from 'axios';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Method } from 'axios';


export interface CustomMutationOptions {
    path: string;
    method: Method;
    data: any;
}

export interface CustomQueryOptions {
    queryKey: string;
    enabled?: boolean;
    path: string;
    refetchOnWindowFocus?: boolean;
}

export interface AxiosInstanceExtended extends AxiosInstance {
    [key: string]: any;
}

const api: AxiosInstanceExtended = axios.create({
    withCredentials: true,
    baseURL:
        window.location.hostname === 'localhost'
            ? import.meta.env.VITE_REACT_APP_API_URL
            : import.meta.env.VITE_REACT_APP_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});


api.interceptors.request.use(
    async (config: any): Promise<any> => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        Promise.reject(error);
    }
);


export const useCustomGetQuery = ({ queryKey, enabled, path, refetchOnWindowFocus }: CustomQueryOptions) => {

    const { isLoading, error, data, isFetching } = useQuery({
        queryKey: [queryKey],
        refetchOnWindowFocus: refetchOnWindowFocus ?? false,
        enabled: enabled,
        queryFn: () =>
            api.get(path)
                .then((res) => res.data),
    });

    if (error?.message === "Request failed with status code 401") {
        console.log(error, data)
    }

    return { isLoading, error, data, isFetching };
};


export const useCustomMutation = () => {
    const mutationFn = async (options: CustomMutationOptions) => {
        const { data: app, method, path } = options;

        try {
            const response = await api[method](path, app);

            if (response.status === 302 && response.headers.location) {
                // Yönlendirme URL'sine yönlendir
                window.location.href = response.headers.location;
                return;
            }

            return response;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    const mutation = useMutation({ mutationFn });
    return mutation;
};

export const getRequestOptions = (token: any) => {
    const requestOptions = {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    }
    return requestOptions
}