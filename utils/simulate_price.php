<?php
function simulatePrice($lastPrice, $result) {
    $volatility = 0.05 * $lastPrice;
    $direction = $result === 'green' ? 1 : ($result === 'red' ? -1 : 0);
    $change = $volatility * (0.5 + (rand(0, 100) / 100));
    $open = $lastPrice;
    $close = $lastPrice + $direction * $change;
    $high = max($open, $close) + rand(1, 5);
    $low = min($open, $close) - rand(1, 5);

    return [
        'open' => round($open, 2),
        'close' => round($close, 2),
        'high' => round($high, 2),
        'low' => round($low, 2)
    ];
}
?>