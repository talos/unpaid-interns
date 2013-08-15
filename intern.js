/*
 * Copyright (C) 2012 John Krauss
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint browser: true*/
/*globals $*/

(function () {
    "use strict";
    var QUESTIONS_LOCATION = "data/questions.tsv",
        DEMOGRAPHICS_LOCATION = "data/demographics.tsv",
        VERSION = "1",
        FIRST_QUESTION = "1",
        BUTTON_COLUMNS = ['Yes', 'No', "Not sure"],
        MESSAGE_COLUMN = 'Message',
        BUTTON_CLASSES = 'btn btn-large',
        BUTTON_TEMPLATE = '<button class="' + BUTTON_CLASSES + '" />',
        RECORD_HOST = 'http://intern-labor-survey.herokuapp.com/',
        RECORD_ENDPOINT = '',
        $intro = $('#intro'),
        $question = $('#question').hide(),
        $doSurvey = $('#do-survey'),
        $demographics = $('#demographics').hide(),
        $demographicsQuestions = $('#demographics #questions'),
        $thanks = $('#thanks').hide(),
        $choices = $('#choices'),
        $endgame = $('#endgame'),
        $reset = $('#reset a'),
        $start = $('#start a'),
        $submit = $('#submit a'),
        questions,
        demographics,

        /**
         * Display the endgame scenario.
         */
        endgame = function (id) {
            $question.hide();
            $doSurvey.show();
            //$reset.hide();
            $('#' + id).show().parents().show();
        },

        /**
         * Input is a raw multi-line TSV as a string.  Output is a JSON
         * object with the first column used as the key for the hash.
         */
        parseTSV = function (tsv) {
            var parsed = {},
                rows = tsv.split('\n'),
                header = rows.shift().split('\t');
            $.each(rows, function (i, row) {
                var cols = row.split('\t'),
                    question = {};
                $.each(cols, function (i, col) {
                    question[header[i]] = col;
                });
                // assume first data column is ID
                parsed[cols[0]] = question;
            });
            return parsed;
        },

        /**
         * Record the response to a question.
         */
        record = function (question, button) {
            $.ajax({
                url: RECORD_HOST + RECORD_ENDPOINT,
                data: {q: question, a: button, v: VERSION},
                crossDomain: true
            });
        },

        /**
         * Ask a question.
         */
        ask = function (id) {
            var question = questions[id];
            $('.text', $question).text(question[MESSAGE_COLUMN]);
            $choices.empty();
            $.each(BUTTON_COLUMNS, function (i, button) {
                var nextId = question[button];
                if (nextId !== '') {
                    $(BUTTON_TEMPLATE)
                        .text(button)
                        .on('click', function () {
                            record(question[MESSAGE_COLUMN], button);
                            if (questions[nextId]) {
                                ask(nextId);
                            } else {
                                endgame(nextId);
                            }
                        }).appendTo($choices);
                }
            });
        };

    // load questions
    $.get(QUESTIONS_LOCATION).done(function (resp) {
        // stateful
        questions = parseTSV(resp);
        $start.on('click', function () {
            $('div', $endgame).hide();
            $intro.slideUp();
            $question.show();
            ask(FIRST_QUESTION);
        });
        $reset.on('click', function () {
            $thanks.slideUp('fast', function () {
                $intro.slideDown();
            });
        });
        $doSurvey.on('click', function () {
            $endgame.slideUp('fast', function () {
                $demographics.slideDown();
            });
        });
        $submit.on('click', function () {
            $demographics.slideUp('fast', function () {
                $thanks.slideDown();
            });
        });
    });

    // load demographics (not shown immediately)
    $.get(DEMOGRAPHICS_LOCATION).done(function (resp) {
        var i, j, l, $q, $s,
            submit = function (evt) {
                var $el = $(evt.target),
                    q = $el.parent().text(),
                    a = $el.val();
                if (q && a) {
                    record($el.parent().text(), $el.val());
                }
            };
        resp = resp.split('\n');
        for (i = 0; i < resp.length; i += 1) {
            l = resp[i].split('\t');
            $q = $('<div />').text(l[0]);
            // free response
            if (l.length === 2) {
                $s = $(l[1]);
                if ($s.is('textarea')) {
                    $q.append($s);
                } else {
                    $q.prepend($s);
                }
            // specific options
            } else if (l.length > 2) {
                $s = $('<select />')
                    .append('<option value="" />')
                    .appendTo($q);
                for (j = 1; j < l.length; j += 1) {
                    $s.append($('<option />').attr('value', l[j]).text(l[j]));
                }
            }
            $s.on('blur', submit);
            $demographicsQuestions.append($q);
        }
    });
}());
