<?php
function getGameResult($greenTotal, $redTotal)
{
    // If no bets, return truly random outcome
    if ($greenTotal == 0 && $redTotal == 0) {
        $options = ['green', 'red', 'doji_green', 'doji_red'];
        return $options[array_rand($options)];
    }

    // If equal amount of bets, return random doji
    if ($greenTotal == $redTotal) {
        return rand(0, 1) ? 'doji_green' : 'doji_red';
    }

    // House wins: pick side with fewer total bets
    return ($greenTotal < $redTotal) ? 'green' : 'red';
}
