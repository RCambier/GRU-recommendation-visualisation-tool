from sklearn.manifold import TSNE
import numpy as np
import lasagne
import theano
import cPickle
from data_handling import DataHandler
import os
import sys
from GRULayer import GRULayer
import theano.tensor as T

# Model used here: rnn_cce_db0.0_r0.0_ml30_bs10_ne45.879_GRU_gc100_h50_Ug_lr0.1_nt1_nf
DATASET = "network/datasets/"
MAX_LENGTH = 30
TYPE = "RNN"
BATCH_SIZE = 1
RECURRENT_LAYER_SIZE = 50
INPUT_SIZE = 3706
N_ITEM = 3706

GENRES = ['ACTION','ADVENTURE','ANIMATION','CHILDREN','COMEDY','CRIME','DOCUMENTARY','DRAMA','FANTASY','FILMNOIR','HORROR','MUSICAL','MYSTERY','ROMANCE','SCIFI','THRILLER','WAR','WESTERN']
COLORS = [[255,0,0],[0,255,24],[255,237,0],[124,248,244],[181,2,255],[150,150,150],[82,175,95],[151,91,61],[111, 108, 255],[0,0,0],[79, 79, 79],[255, 186, 67],[53, 53, 140],[247, 159, 255],[138, 238, 238],[169, 13, 13],[181, 152, 84],[0,0,255]]

class RNN:

    def prepare_model(self):
        self.dataset = DataHandler(dirname=DATASET)
        self.create_network()
        self.load_model()
        self._compile_H_function()
        self._compile_predict_function()
        self._compile_gate_function()
        self._compile_saliency_function()
        self.users_reduced_trace = None
        self.movies_reduced_trace = None

    def users_reduced(self,sequenceNbr):
        H_table = []
        print("Getting H on one epoch...")
        for sequence, user_id in self.dataset.test_set(epochs=1):
            x,mask, init_seq, goals = self.prepare_sequence_data(sequence)
            recurrent_output = self.H_function(x,mask)
            H_table.append(recurrent_output[0])

        model = TSNE(n_components=2)
        print("Reducing H to 2 dimensions...")

        self.users_reduced_trace = self.read_or_compute_TSNE(np.array(H_table)[:, sequenceNbr, :], model, 'users')
        print("Done.")
        return self.users_reduced_trace


    def users_prediction_rates(self):
        prediction_rate_table = []
        for sequence, user_id in self.dataset.test_set(epochs=1):
            x, mask, init_seq, goals = self.prepare_sequence_data(sequence)
            predictions = self.predict_function(x, mask)
            prediction_rate_table.append(float(np.mean([predictions[iter][item] for iter, item in enumerate(goals)])))
        return prediction_rate_table


    def prediction(self,_user_id):
        for sequence, user_id in self.dataset.test_set(epochs=1):
            if _user_id == user_id:
                x, mask, init_sequence, goals = self.prepare_sequence_data(sequence)
                predictions = self.predict_function(x,mask)
                [recurrent_output] = self.H_function(x, mask)
                return {'H':recurrent_output[:mask[0].tolist().count(1.0)].tolist(),
                        'init_sequence':init_sequence,
                        'goals':goals,
                        'predictions':[{'input':init_sequence[id],'prediction':row.tolist()} for id,row in enumerate(predictions[:mask[0].tolist().count(1.0)])]
                        }
        sys.stderr.write("Asked for prediction of not existing user_id " +_user_id + "\n")
        return None

    def sorted_heatmap(self, _user_id):
        for sequence, user_id in self.dataset.test_set(epochs=1):
            if _user_id == user_id:
                x, mask, init_sequence, goals = self.prepare_sequence_data(sequence)
                [recurrent_output] = self.H_function(x, mask)
                recurrent_output = recurrent_output[:mask[0].tolist().count(1.0)]
                model = TSNE(n_components=1)
                print("Reducing H's to 1 dimension to sort it...")
                heatmap = recurrent_output.T
                kernel = np.array([0.2,0.3,0.5,1,0.5,0.3,0.2])
                blurred = [np.convolve(line, kernel/float(sum(kernel)), mode='same') for line in np.abs(heatmap)]
                #lines = np.abs(recurrent_output.T)
                order = model.fit_transform(blurred);
                new_recurrent_output = np.transpose([lin for (ord,lin) in sorted(zip(order,heatmap))])

                return new_recurrent_output

        sys.stderr.write("Asked for prediction of not existing user_id " +_user_id + "\n")
        return None

    def user_gates(self, _user_id):
        for sequence, user_id in self.dataset.test_set(epochs=1):
            if _user_id == user_id:
                x, mask, init_sequence, goals = self.prepare_sequence_data(sequence)
                recurrent_output, reset, update, hidden_update =  self.gate_function(x, mask)
                recurrent_output = recurrent_output[0]
                reset = reset[:,0,:]
                update = update[:,0,:]
                hidden_update = hidden_update[:,0,:]
                return {'recurrent_output':recurrent_output[:mask[0].tolist().count(1.0)].tolist(),
                        'reset_gate':reset[:mask[0].tolist().count(1.0)].tolist(),
                        'update_gate':update[:mask[0].tolist().count(1.0)].tolist(),
                        'hidden_update': hidden_update[:mask[0].tolist().count(1.0)].tolist()}


        sys.stderr.write("Asked for prediction of not existing user_id " + _user_id + "\n")
        return None

    def user_saliency(self, _user_id, movie_id, sequence_step):
        for sequence, user_id in self.dataset.test_set(epochs=1):
            if _user_id == user_id:
                x, mask, init_sequence, goals = self.prepare_sequence_data(sequence, step_clip=int(sequence_step))
                saliency, max_class = self.saliency_function(x, mask,int(movie_id))
                saliency_max = np.max(np.abs(saliency[0]), axis=1)
                saliency_mean = np.mean(np.abs(saliency[0]), axis=1)
                return({'max': saliency_max.tolist(), 'mean': saliency_mean.tolist()})
        sys.stderr.write("Asked for prediction of not existing user_id " + _user_id + "\n")
        return None

    def users_titles(self):
        users_table = []
        for sequence, user_id in self.dataset.test_set(epochs=1):
            users_table.append(user_id)
        return users_table

    @staticmethod
    def inner_product_metric(a,b):
        return np.exp(-np.inner(a,b))

    def movies_reduced(self):
            W = self.l_out.W.get_value().T
            model = TSNE(n_components=2, metric=self.inner_product_metric, verbose=2)
            print("Reducing W to 2 dimensions")
            self.movies_reduced_trace = self.read_or_compute_TSNE(np.array(W), model, 'movies')
            print("Done.")
            return self.movies_reduced_trace

    def movie_bias(self):
        return self.l_out.b.get_value().tolist()

    def movies_titles(self):
        dic_compact2ml = self.dataset._load_mapping("ids_compact2ml")
        dic_ml2titles = self.dataset._load_titles("movies.dat")
        titles_dates = [dic_ml2titles[dic_compact2ml[movie_id]] for movie_id in range(len(dic_compact2ml))]
        return titles_dates


    def movies_genre_colors(self):
        dic_year_genre = self.dataset._load_year_and_genre("year_and_genre")
        colors = self.genre_movie_color([dic_year_genre[movieId][1:] for movieId in range(N_ITEM)])
        return colors

    def movies_popularity(self):
        popularity = self.dataset._load_ratings_pop("avg_rating_and_popularity")
        return popularity

    def genre_movie_color(self,genres):
        colors = []
        for genre in genres:
            newcolor = []
            for (index, col) in enumerate(COLORS):
                if genre[index] == 1:
                    newcolor.append(col)
            newcolor = np.mean(newcolor, axis=0)
            colors.append(newcolor)

        final_color = ['rgb(' + str(int(r)) + ',' + str(int(g)) + ',' + str(int(b)) + ')' for [r, g, b] in colors]
        return final_color



    def create_network(self):
        self.l_in = lasagne.layers.InputLayer(shape=(BATCH_SIZE, MAX_LENGTH, INPUT_SIZE))
        self.l_mask = lasagne.layers.InputLayer(shape=(BATCH_SIZE, MAX_LENGTH))
        self.l_recurrent = GRULayer(self.l_in, RECURRENT_LAYER_SIZE,  mask_input=self.l_mask, grad_clipping=100, learn_init=True, only_return_final=False)
        self.l_last_slice = lasagne.layers.SliceLayer(self.l_recurrent, -1, axis=1)
        self.l_out = lasagne.layers.DenseLayer(self.l_last_slice, num_units=N_ITEM, nonlinearity=lasagne.nonlinearities.softmax)

        #self.l_reshaped_recurrent = lasagne.layers.ReshapeLayer(self.l_recurrent, (-1,[2]))
        #self.l_multiple_out  = lasagne.layers.DenseLayer(self.l_reshaped_recurrent, num_units=N_ITEM, nonlinearity=lasagne.nonlinearities.softmax)


        self.l_multiple_output = lasagne.layers.DenseLayer(self.l_recurrent, num_units=N_ITEM, nonlinearity=None, num_leading_axes=2)
        self.l_reshaped_output = lasagne.layers.ReshapeLayer(self.l_multiple_output,(-1,[2]) )
        self.l_nonlinearity  = lasagne.layers.NonlinearityLayer(self.l_reshaped_output, nonlinearity=lasagne.nonlinearities.softmax)

    def load_model(self):
        f = file("network/datasets/models/model", 'rb')
        param = cPickle.load(f)
        f.close()

        lasagne.layers.set_all_param_values(self.l_out, [i.astype(theano.config.floatX) for i in param])
        lasagne.layers.set_all_param_values(self.l_nonlinearity, [i.astype(theano.config.floatX) for i in param])


    def _compile_H_function(self):
        ''' Compile self.predict, the deterministic rnn that output the prediction at the end of the sequence
        '''
        print("Compiling H (with intermediate outputs)...")
        recurrent_output = lasagne.layers.get_output(self.l_recurrent, deterministic=True)
        self.H_function = theano.function([self.l_in.input_var, self.l_mask.input_var],recurrent_output, allow_input_downcast=True, name="H_function")
        print("Compilation done.")

    def _compile_gate_function(self):
        print("Compiling gate function")
        recurrent_output, resetgate, updategate, hidden_update = self.l_recurrent.get_output_and_gates_for(
            [layer.input_var for layer in self.l_recurrent.input_layers])
        self.gate_function = theano.function([self.l_in.input_var, self.l_mask.input_var],
                                             [recurrent_output, resetgate, updategate, hidden_update], name="Gate_function",
                                             allow_input_downcast=True)
        print("Compilation done")

    def _compile_predict_function(self):
        print("Compiling predict...")
        network_prediction = lasagne.layers.get_output(self.l_nonlinearity, deterministic=True)
        self.predict_function = theano.function([self.l_in.input_var, self.l_mask.input_var], network_prediction,
                                          allow_input_downcast=True, name="predict_function")

        # network_prediction_single = lasagne.layers.get_output(self.l_out, deterministic=True)
        # self.predict_function_single = theano.function([self.l_in.input_var, self.l_mask.input_var], network_prediction_single,
        #                                         allow_input_downcast=True, name="predict_function_single")
        print("Compilation done.")

    def _compile_saliency_function(self):
        print("Compiling saliency function.")
        movie_id = T.scalar('movie_id', dtype='int32')
        outp = lasagne.layers.get_output(self.l_out, deterministic=True)
        #max_outp = T.max(outp, axis=1)
        focus_outp = outp[0][movie_id]
        saliency = theano.grad(focus_outp.sum(), wrt=self.l_in.input_var)
        max_class = T.argmax(outp, axis=1)
        self.saliency_function = theano.function([self.l_in.input_var, self.l_mask.input_var, movie_id], [saliency, max_class],allow_input_downcast=True)
        print("Compilation done.")


    def prepare_sequence_data(self, _sequence, step_clip = None):
        sequence = _sequence[:int(len(_sequence)/2)]
        goals = [elem for  [elem,rating] in _sequence[1:int(len(_sequence)/2)+1]]
        goals = goals[-min(MAX_LENGTH, len(sequence)):]
        max_length_seq = sequence[-min(MAX_LENGTH, len(sequence)):]
        if step_clip != None:
            max_length_seq = max_length_seq[:step_clip+1]
        init_sequence = [id for [id,rating] in max_length_seq]
        X = np.zeros((1, MAX_LENGTH, INPUT_SIZE), dtype='int32')  # input of the RNN
        X[0, :len(max_length_seq), :] = np.array([RNN.to_one_hot(elem,N_ITEM) for [elem,rating] in max_length_seq])
        mask = np.zeros((1, MAX_LENGTH))  # mask of the input (to deal with sequences of different length)
        mask[0, :len(max_length_seq)] = 1
        return (X, mask.astype(theano.config.floatX),init_sequence,goals )


    # If a file exists with initial matrix and TSNE reduction of this matrix, reads the file, checks if the matrix is the same, and returns the TSNE reduction. If the matrix is different, computes the TSNE and save it to file.
    # Else, computes the TSNE and save to file.
    def read_or_compute_TSNE(self, newMatrix, model, name_extension):

        if os.path.exists('network/temp_out/reduced_and_matrix_'+name_extension+'.npz'):
            data = np.load('network/temp_out/reduced_and_matrix_'+name_extension+'.npz')
            reduced = data['reduced']
            matrix = data['matrix']
            if np.array_equal(newMatrix, matrix):
                print("Already reduced.")
                return reduced
            else:
                print("Reducing...")
                reduced = model.fit_transform(newMatrix)
                np.savez('network/temp_out/reduced_and_matrix_'+name_extension+'.npz', matrix = newMatrix, reduced= reduced)
                return reduced
        else:
            print("Reducing...")
            reduced = model.fit_transform(newMatrix)
            np.savez('network/temp_out/reduced_and_matrix_'+name_extension+'.npz', matrix=newMatrix, reduced=reduced)
            return reduced

    @staticmethod
    def to_one_hot(index, length):
        oh = np.zeros(length)
        np.put(oh, index, 1)
        return oh




