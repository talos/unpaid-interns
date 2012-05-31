/*jslint browser: true*/
/*globals $*/

(function () {
    "use strict";

    var $question = $('#question'),
        $choices = $('#choices'),
        $legal = $('#legal'),
        $illegal = $('#illegal'),
        $reset = $('#reset'),

        ask = function (question, answer, choices) {
            var dfd = new $.Deferred();
            $question.text(question);
            $choices.empty();
            $.each(choices, function (idx, choice) {
                $choices.append($("<button />")
                    .text(choice)
                    .on('click', function () {
                        if (answer === choice) {
                            dfd.resolve();
                        } else {
                            dfd.reject(question, answer);
                        }
                    }));
            });
            return dfd.promise();
        },

        qa = function (question, answer) {
            return function () {
                return ask(question, answer, ['Aye', 'Nay']);
            };
        },

        run = function () {
            $illegal.hide();
            $legal.hide();

            var dfd = new $.Deferred(),
                questionnaire = dfd.pipe(qa('Are you receiving training?', 'Aye'))
                    .pipe(qa("Is your training similar to what you would get at school?", 'Aye'))
                    .pipe(qa("Are you displacing regular employees?", 'Nay'))
                    .pipe(qa("Are you closely supervised?", 'Aye'))
                    .pipe(qa("Are you entitled to a job at your office when the internship is over?", 'Nay'));

            // Start questionnaire
            dfd.resolve();

            questionnaire.done(function () {
                $legal.fadeIn();
            }).fail(function () {
                $illegal.fadeIn();
            }).always(function () {
                $question.empty();
                $choices.empty();
            });
        };

    run();
    $reset.on('click', run);
}());


/*
The internship, even though it includes actual operation of the facilities of the employer, is similar to training which would be given in an educational environment;
The internship experience is for the benefit of the intern;
The intern does not displace regular employees, but works under close supervision of existing staff;
The employer that provides the training derives no immediate advantage from the activities of the intern; and on occasion its operations may actually be impeded;
The intern is not necessarily entitled to a job at the conclusion of the internship; and
The employer and the intern understand that the intern is not entitled to wages for the time spent in the internship.
*/
