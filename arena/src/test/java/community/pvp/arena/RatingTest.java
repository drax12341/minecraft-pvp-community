package community.pvp.arena;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class RatingTest {
  @Test
  void equalPlayersExchangeSixteenPoints() {
    assertEquals(16, Rating.delta(1000, 1000));
  }

  @Test
  void upsetPaysMoreAndFavoritePaysLess() {
    assertTrue(Rating.delta(800, 1400) > 16);
    assertTrue(Rating.delta(1400, 800) < 16);
  }

  @Test
  void ranksHaveStableBoundaries() {
    assertEquals("Bronze", Rating.rank(0));
    assertEquals("Iron", Rating.rank(800));
    assertEquals("Netherite", Rating.rank(2000));
  }

  @Test
  void transferNeverCreatesPointsAtFloor() {
    int d = Rating.transfer(0, 3);
    assertEquals(3, d);
    assertEquals(0, Rating.transfer(1000, 0));
  }

  @Test
  void queueWindowWidensButHasACap() {
    assertEquals(100, Rating.window(0));
    assertEquals(700, Rating.window(600));
  }
}
