import os
import ast
import compress_pickle
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMAResults
from sklearn.neighbors import NearestNeighbors

############################## BEGIN:CONSTANTS ##############################
N_SEASONS = 12
N_HOURS = 8760
N_DAYS = 365

DAY_IN_MONTHS = np.array([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
assert len(DAY_IN_MONTHS) == N_SEASONS

CUMSUM_DAY = np.insert(np.cumsum(DAY_IN_MONTHS), 0, [0])
assert len(CUMSUM_DAY) == N_SEASONS + 1
assert CUMSUM_DAY[0] == 0

HOURS = np.arange(N_HOURS)
DAYS = np.arange(N_DAYS)
SEASONS = np.arange(N_SEASONS)

## TODO: TUNE THIS ALPHA
ALPHA = 0.2

MONTHLY_LOADS_DIR = os.environ.get("SAMPLE_MONTHLY_LOADS_PATH")
MODELS_DIR = os.environ.get("ARMA_MODELS_PATH")
##############################  END:CONSTANTS  ##############################


class KnnARIMAModelSimulator:

    def __init__(self, arima_models_dir=MODELS_DIR, knn_n_neighbors=5, knn_metric='manhattan'):
        '''
        Make a KnnARIMAModelSimulator.

        Parameters:
        arima_models_dir: Location of the pre-trained ARIMA models relative to current working directory.
        knn_n_neighbors: Number of neighbors to generate in the KNN model. Simulation uses these nearest neighbors in a round-robin fashion.
        knn_metric: Distance metric for KNN.

        Returns:
        KnnARIMAModelSimulator
        '''

        ## define any sub-functions first...
        def from_np_array(array_string):
            array_string = ','.join(array_string.replace('[ ', '[').split())
            return np.array(ast.literal_eval(array_string))

        ## save params
        self.n_neighbors = knn_n_neighbors
        self.arima_models_dir = arima_models_dir

        ## get available stations
        available_station_ids = [f.split('_alpha')[0] for f in os.listdir(arima_models_dir)]

        ## monthly loads dataframe
        __monthly_loads = pd.read_csv(MONTHLY_LOADS_DIR, converters={'SumLoad': from_np_array, 'NormLoad': from_np_array, 'AvgLoad': from_np_array})
        self.monthly_loads = __monthly_loads[__monthly_loads['ID'].isin(available_station_ids)].reset_index(drop=True)
        
        ## columns as np arrays
        self.station_ids = self.monthly_loads["ID"].values
        self.monthly_sum_loads = np.stack(self.monthly_loads["SumLoad"].values, axis=0)
        self.monthly_norm_loads = np.stack(self.monthly_loads["NormLoad"].values, axis=0)
        self.monthly_mean_loads = np.stack(self.monthly_loads["AvgLoad"].values, axis=0)
        self.monthly_norm_ratio = self.monthly_loads["NormRatio"].values

        ## train knn model
        self.knn_model = NearestNeighbors(n_neighbors=self.n_neighbors, metric=knn_metric).fit(self.monthly_norm_loads)

    def __get_arma_model(self, station_id):
        station_filename = f"{self.arima_models_dir}{station_id}_alpha{ALPHA}.p.lzma"
        return compress_pickle.load(station_filename)

    def __simulate_arma_model(self, knn_arma_model, num_gen_traces):

        models, m_traces, s_traces = knn_arma_model
        
        r_gen_hourly = np.zeros((num_gen_traces, N_HOURS))

        for s in range(N_SEASONS):
            index_season = range(CUMSUM_DAY[s] * 24, CUMSUM_DAY[s + 1] * 24)
            len_season = DAY_IN_MONTHS[s] * 24

            r_mat = models[s].simulate(nsimulations=num_gen_traces * len_season).reshape((num_gen_traces, len_season))
            r_gen_hourly[:, index_season] = r_mat

        return r_gen_hourly + m_traces + s_traces


    def simulate_hourly_data(self, sample_monthly_load, num_gen_traces=None, return_knn_station_ids=False):
        """
        Simulates a total of `num_gen_traces` hourly samples from monthly load, based on closest monthly data.

        Parameters:
        monthly_load (array_like): A metadata for monthly load.
        num_gen_traces (int, optional): Total number of traces to generate. If not provided, use `n_neighbors` provided in initialization.
        return_knn_station_ids (bool, optional): If True, return knn_station_ids

        Returns:
        np.ndarray, shape (num_gen_traces, N_HOURS): Simulated hourly data derived from ARIMA models.
        (optional) np.ndarray, shape (self.n_neighbors)
        """

        ## Fill in num_gen_traces
        sample_monthly_load = np.array(sample_monthly_load)
        num_gen_traces = self.n_neighbors if num_gen_traces is None else num_gen_traces

        ## Get load norm ratio
        sample_monthly_load_norm_ratio = max(sample_monthly_load)
        sample_norm_load = sample_monthly_load / sample_monthly_load_norm_ratio

        ## Find KNN
        knn_indexes = self.knn_model.kneighbors([sample_norm_load], return_distance=False)[0]
        knn_station_ids = self.station_ids[knn_indexes]
        knn_ratios = self.monthly_norm_ratio[knn_indexes]

        ## Retrieve Models for KNN
        knn_arma_models = [self.__get_arma_model(station_id) for station_id in knn_station_ids]

        ## Generate hourly data based on simulations
        gen_hourly = np.zeros((num_gen_traces, N_HOURS))

        for i, arma_model in enumerate(knn_arma_models):
            index_gen_samples = range(i, num_gen_traces, self.n_neighbors) # round robin mechanism for each near neighbor
            len_gen_samples = len(index_gen_samples)
            if len_gen_samples > 0:
                gen_hourly[index_gen_samples] = self.__simulate_arma_model(arma_model, len_gen_samples) / knn_ratios[i] * sample_monthly_load_norm_ratio

        if return_knn_station_ids:
            return (gen_hourly, knn_station_ids)
        else:
            return gen_hourly
